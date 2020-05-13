var pl;
(function( pl ) {

	var predicates = function() {
		
		return {
			
			// OPERATING SYSTEM INTERACTION

			// shell/1
			"shell/1": function( thread, point, atom ) {
				var command = atom.args[0];
				thread.prepend( [new pl.type.State(
					point.goal.replace( new pl.type.Term("shell", [command, new pl.type.Num(0, false)]) ),
					point.substitution,
					point
				)] );
			},

			// shell/2
			"shell/2": function( thread, point, atom ) {
				var command = atom.args[0], status = atom.args[1];
				if( pl.type.is_variable(command) ) {
					thread.throw_error( pl.error.instantiation( atom.indicator ) );
				} else if( !pl.type.is_atom(command) ) {
					thread.throw_error( pl.error.type( "atom", command, atom.indicator ) );
				} else if( !pl.type.is_variable(status) && !pl.type.is_integer(status) ) {
					thread.throw_error( pl.error.type( "integer", status, atom.indicator ) );
				} else {
					if(thread.get_flag("nodejs").indicator === "true/0") {
						const { exec } = require('child_process');
						exec( command.id, function() {} ).on( 'exit', function(code) {
							thread.prepend( [new pl.type.State(
								point.goal.replace( new pl.type.Term("=", [status, new pl.type.Num(code, false)]) ),
								point.substitution,
								point
							)] );
							thread.again();
						} );
						return true;
					} else {
						try {
							eval( command.id );
							thread.prepend( [new pl.type.State(
								point.goal.replace( new pl.type.Term("=", [status, new pl.type.Num(0, false)]) ),
								point.substitution,
								point
							)] );
						} catch( error ) {
							thread.prepend( [new pl.type.State(
								point.goal.replace( new pl.type.Term("=", [status, new pl.type.Num(1, false)]) ),
								point.substitution,
								point
							)] );
						}
					}
				}
			},

			// directory_files/2
			"directory_files/2": function(thread, point, atom) {
				var path = atom.args[0], entries = atom.args[1];
				if(pl.type.is_variable(path)) {
					thread.throw_error(pl.error.instantiation(atom.indicator));
				} else if(!pl.type.is_atom(path)) {
					thread.throw_error(pl.error.type("atom", path, atom.indicator));
				} else if(!pl.type.is_variable(entries) && !pl.type.is_list(entries)) {
					thread.throw_error(pl.error.type("list", entries, atom.indicator));
				} else {
					if(thread.get_flag("nodejs").indicator === "true/0") {
						var fs = require('fs');
						fs.readdir(path.id, function(error, items) {
							if(error) {
								thread.throw_error(pl.error.existence("directory", path, atom.indicator));
							} else {
								var listing = new pl.type.Term("[]", []);
								for(var i = items.length-1; i >= 0; i--)
									listing = new pl.type.Term(".", [new pl.type.Term(items[i], []), listing]);
								thread.prepend([new pl.type.State(
									point.goal.replace(new pl.type.Term("=", [entries, listing])),
									point.substitution,
									point
								)]);
							}
							thread.again();
						});
						return true;
					} else {
						var absolute = pl.utils.cd(thread.session.working_directory, path.id);
						var file = thread.session.file_system.get(absolute);
						if(file && !pl.type.is_file(file)) {
							var items = [];
							for(var prop in file)
								items.push(prop);
							var listing = new pl.type.Term("[]", []);
							for(var i = items.length-1; i >= 0; i--)
								listing = new pl.type.Term(".", [new pl.type.Term(items[i], []), listing]);
							thread.prepend([new pl.type.State(
								point.goal.replace(new pl.type.Term("=", [entries, listing])),
								point.substitution,
								point
							)]);
						} else {
							thread.throw_error(pl.error.existence("directory", path, atom.indicator));
						}
					}
				}
			},

			// working_directory/2
			"working_directory/2": function(thread, point, atom) {
				var oldcwd = atom.args[0], newcwd = atom.args[1];
				if(pl.type.is_variable(newcwd) && (!pl.type.is_variable(oldcwd) || oldcwd.id !== newcwd.id)) {
					thread.throw_error(pl.error.instantiation(atom.indicator));
				} else if(!pl.type.is_variable(oldcwd) && !pl.type.is_atom(oldcwd)) {
					thread.throw_error(pl.error.type("atom", oldcwd, atom.indicator));
				} else if(!pl.type.is_variable(newcwd) && !pl.type.is_atom(newcwd)) {
					thread.throw_error(pl.error.type("atom", newcwd, atom.indicator));
				} else {
					var wd;
					if(thread.get_flag("nodejs").indicator === "true/0") {
						wd = process.cwd();
						if(!pl.type.is_variable(newcwd))
							process.chdir(newcwd.id);
					} else {
						wd = thread.session.working_directory;
						if(!pl.type.is_variable(newcwd)) {
							thread.session.working_directory = pl.utils.cd(wd, newcwd.id);
						}
					}
					thread.prepend([new pl.type.State(
						point.goal.replace(new pl.type.Term("=", [oldcwd, new pl.type.Term(wd, [])])),
						point.substitution,
						point
					)]);
				}
			},

			// delete_file/1
			"delete_file/1": function(thread, point, atom) {
				var path = atom.args[0];
				if(pl.type.is_variable(path)) {
					thread.throw_error(pl.error.instantiation(atom.indicator));
				} else if(!pl.type.is_atom(path)) {
					thread.throw_error(pl.error.type("atom", path, atom.indicator));
				} else {
					if(thread.get_flag("nodejs").indicator === "true/0") {
						var fs = require('fs');
						fs.stat(path.id, function(error, stat) {
							if(!error && stat.isFile()) {
								fs.unlink(path.id, function(error) {
									if(error)
										thread.throw_error(pl.error.permission("delete", "source_sink", path, atom.indicator));
									else
										thread.success( point );
									thread.again();
								});
							} else {
								thread.throw_error(pl.error.existence("source_sink", path, atom.indicator));
								thread.again();
							}
						});
						return true;
					} else {
						var absolute = pl.utils.cd(thread.session.working_directory, path.id);
						var file = thread.session.file_system.get(absolute);
						if(file && pl.type.is_file(file)) {
							delete file.parent[file.name];
							thread.success(point);
						} else {
							thread.throw_error(pl.error.existence("source_sink", path, atom.indicator));
						}
					}
				}
			},

			// delete_directory/1
			"delete_directory/1": function(thread, point, atom) {
				var path = atom.args[0];
				if(pl.type.is_variable(path)) {
					thread.throw_error(pl.error.instantiation(atom.indicator));
				} else if(!pl.type.is_atom(path)) {
					thread.throw_error(pl.error.type("atom", path, atom.indicator));
				} else {
					if(thread.get_flag("nodejs").indicator === "true/0") {
						var fs = require('fs');
						fs.stat(path.id, function(error, stat) {
							if(!error && stat.isDirectory()) {
								fs.rmdir(path.id, function(error) {
									if(error)
										thread.throw_error(pl.error.permission("delete", "directory", path, atom.indicator));
									else
										thread.success( point );
									thread.again();
								});
							} else {
								thread.throw_error(pl.error.existence("directory", path, atom.indicator));
								thread.again();
							}
						});
						return true;
					} else {
						var absolute = pl.utils.cd(thread.session.working_directory, path.id);
						var dirs = absolute.replace(/\/$/, "").split("/");
						var dir = thread.session.file_system.files;
						var name = dirs[dirs.length-1];
						for(var i = 1; i < dirs.length-1; i++) {
							if(dir.hasOwnProperty(dirs[i]))
								dir = dir[dirs[i]];
							else {
								thread.throw_error(pl.error.existence("directory", path, atom.indicator));
								return;
							}
						}
						if(!dir.hasOwnProperty(name) || pl.type.is_file(dir[name])) {
							thread.throw_error(pl.error.existence("directory", path, atom.indicator));
						} else {
							if(is_empty(dir[name])) {
								delete dir[name];
								thread.success(point);
							} else {
								thread.throw_error(pl.error.permission("delete", "directory", path, atom.indicator));
							}
						}
					}
				}
			},

			// make_directory/1
			"make_directory/1": function(thread, point, atom) {
				var path = atom.args[0];
				if(pl.type.is_variable(path)) {
					thread.throw_error(pl.error.instantiation(atom.indicator));
				} else if(!pl.type.is_atom(path)) {
					thread.throw_error(pl.error.type("atom", path, atom.indicator));
				} else {
					if(thread.get_flag("nodejs").indicator === "true/0") {
						var fs = require('fs');
						fs.stat(path.id, function(error, stat) {
							if(!error && (stat.isDirectory() || stat.isFile())) {
								thread.throw_error(pl.error.permission("create", "directory", path, atom.indicator));
								thread.again();
							} else {
								fs.mkdir(path.id, function(error) { 
									if(error)
										thread.throw_error(pl.error.existence("directory", path, atom.indicator));
									else
										thread.success(point);
									thread.again();
								});
							}
						});
						return true;
					} else {
						var absolute = pl.utils.cd(thread.session.working_directory, path.id);
						var dirs = absolute.replace(/\/$/, "").split("/");
						var dir = thread.session.file_system.files;
						var name = dirs[dirs.length-1];
						for(var i = 1; i < dirs.length-1; i++) {
							if(dir.hasOwnProperty(dirs[i]))
								dir = dir[dirs[i]];
							else {
								thread.throw_error(pl.error.existence("directory", path, atom.indicator));
								return;
							}
						}
						if(dir[name]) {
							thread.throw_error(pl.error.permission("create", "directory", path, atom.indicator));
						} else {
							dir[name] = {};
							thread.success(point);
						}
					}
				}
			},

			// rename_file/2
			"rename_file/2": function(thread, point, atom) {
				var old_path = atom.args[0], new_path = atom.args[1];
				if(pl.type.is_variable(old_path) || pl.type.is_variable(new_path)) {
					thread.throw_error(pl.error.instantiation(atom.indicator));
				} else if(!pl.type.is_atom(old_path)) {
					thread.throw_error(pl.error.type("atom", old_path, atom.indicator));
				} else if(!pl.type.is_atom(new_path)) {
					thread.throw_error(pl.error.type("atom", new_path, atom.indicator));
				} else {
					if(thread.get_flag("nodejs").indicator === "true/0") {
						var fs = require('fs');
						fs.stat(old_path.id, function(error, stat) {
							if(error || !stat.isFile()) {
								thread.throw_error(pl.error.existence("source_sink", old_path, atom.indicator));
								thread.again();
							} else {
								fs.rename(old_path.id, new_path.id, function(error) { 
									if(error)
										thread.throw_error(pl.error.existence("source_sink", new_path, atom.indicator));
									else
										thread.success(point);
									thread.again();
								});
							}
						});
						return true;
					} else {
						var old_file = thread.file_system_open(old_path.id, "text", "read");
						if(old_file) {
							var new_file = thread.file_system_open(new_path.id, "text", "write");
							if(new_file) {
								new_file.text = old_file.text;
								var absolute = pl.utils.cd(thread.session.working_directory, old_path.id);
								var dirs = absolute.replace(/\/$/, "").split("/");
								var dir = thread.session.file_system.files;
								var name = dirs[dirs.length-1];
								for(var i = 1; i < dirs.length-1; i++)
									dir = dir[dirs[i]];
								delete dir[name];
								thread.success(point);
							} else {
								thread.throw_error(pl.error.existence("source_sink", new_path, atom.indicator));
							}
						} else {
							thread.throw_error(pl.error.existence("source_sink", old_path, atom.indicator));
						}
					}
				}
			},
			
			// exists_file/1
			"exists_file/1": function(thread, point, atom) {
				var path = atom.args[0];
				if(pl.type.is_variable(path)) {
					thread.throw_error(pl.error.instantiation(atom.indicator));
				} else if(!pl.type.is_atom(path)) {
					thread.throw_error(pl.error.type("atom", path, atom.indicator));
				} else {
					if(thread.get_flag("nodejs").indicator === "true/0") {
						var fs = require('fs');
						fs.stat(path.id, function(error, stat) {
							if(!error && stat.isFile())
								thread.success(point);
							thread.again();
						});
						return true;
					} else {
						var absolute = pl.utils.cd(thread.session.working_directory, path.id);
						var file = thread.session.file_system.get(absolute);
						if(file && pl.type.is_file(file))
							thread.success(point);
					}
				}
			},

			// exists_directory/1
			"exists_directory/1": function(thread, point, atom) {
				var path = atom.args[0];
				if(pl.type.is_variable(path)) {
					thread.throw_error(pl.error.instantiation(atom.indicator));
				} else if(!pl.type.is_atom(path)) {
					thread.throw_error(pl.error.type("atom", path, atom.indicator));
				} else {
					if(thread.get_flag("nodejs").indicator === "true/0") {
						var fs = require('fs');
						fs.stat(path.id, function(error, stat) {
							if(!error && stat.isDirectory())
								thread.success(point);
							thread.again();
						});
						return true;
					} else {
						var absolute = pl.utils.cd(thread.session.working_directory, path.id);
						var file = thread.session.file_system.get(absolute);
						if(file && !pl.type.is_file(file))
							thread.success(point);
					}
				}
			},

			// same_file/2
			"same_file/2": function(thread, point, atom) {
				var fst_path = atom.args[0], snd_path = atom.args[1];
				if(pl.type.is_variable(fst_path) || pl.type.is_variable(snd_path)) {
					thread.throw_error(pl.error.instantiation(atom.indicator));
				} else if(!pl.type.is_atom(fst_path)) {
					thread.throw_error(pl.error.type("atom", fst_path, atom.indicator));
				} else if(!pl.type.is_atom(snd_path)) {
					thread.throw_error(pl.error.type("atom", snd_path, atom.indicator));
				} else {
					if(fst_path.id === snd_path.id) {
						thread.success(point);
					} else {
						if(thread.get_flag("nodejs").indicator === "true/0") {
							var fs = require('fs');
							fs.stat(fst_path.id, function(error, fst_stat) {
								if(!error)
									fs.stat(snd_path.id, function(error, snd_stat) {
										if(!error && fst_stat.dev === snd_stat.dev && fst_stat.ino === snd_stat.ino)
											thread.success(point);
										thread.again();
									});
								else
									thread.again();
							});
							return true;
						} else {
							var working_directory = thread.session.working_directory;
							var fst_file = thread.session.file_system.get(pl.utils.cd(working_directory, fst_path.id));
							var snd_file = thread.session.file_system.get(pl.utils.cd(working_directory, snd_path.id));
							if(fst_file && snd_file && fst_file === snd_file)
								thread.success(point);
						}
					}
				}
			},

			// absolute_file_name/2
			"absolute_file_name/2": function(thread, point, atom) {
				var filename = atom.args[0], absolute = atom.args[1];
				if(pl.type.is_variable(filename)) {
					thread.throw_error(pl.error.instantiation(atom.indicator));
				} else if(!pl.type.is_atom(filename)) {
					thread.throw_error(pl.error.type("atom", filename, atom.indicator));
				} else if(!pl.type.is_variable(absolute) && !pl.type.is_atom(absolute)) {
					thread.throw_error(pl.error.type("atom", absolute, atom.indicator));
				} else {
					var absolute_filename;
					if(thread.get_flag("nodejs").indicator === "true/0") {
						var path = require("path");
						absolute_filename = path.resolve(filename.id);
					} else {
						absolute_filename = pl.utils.cd(thread.session.working_directory, filename.id);
					}
					thread.prepend([new pl.type.State(
						point.goal.replace(new pl.type.Term("=", [
							absolute,
							new pl.type.Term(absolute_filename, [])])),
						point.substitution,
						point
					)]);
				}
			},

			// is_absolute_file_name/1
			"is_absolute_file_name/1": function(thread, point, atom) {
				var filename = atom.args[0];
				if(pl.type.is_variable(filename)) {
					thread.throw_error(pl.error.instantiation(atom.indicator));
				} else if(!pl.type.is_atom(filename)) {
					thread.throw_error(pl.error.type("atom", filename, atom.indicator));
				} else {
					if(thread.get_flag("nodejs").indicator === "true/0") {
						var path = require('path');
						if(path.isAbsolute(filename.id))
							thread.success(point);
					} else {
						if(filename.id.length > 0 && filename.id[0] === "/")
							thread.success(point);
					}
				}
			}
		
		};
		
	};
	
	var exports = ["shell/1", "shell/2", "directory_files/2", "working_directory/2", "delete_file/1", "delete_directory/1", "rename_file/2", "make_directory/1", "exists_file/1", "exists_directory/1", "same_file/2", "absolute_file_name/2", "is_absolute_file_name/1"];

	function is_empty(obj) {
		for(var prop in obj)
			if(obj.hasOwnProperty(prop))
				return false;
		return true;
	}

	if( typeof module !== 'undefined' ) {
		module.exports = function( p ) {
			pl = p;
			new pl.type.Module( "os", predicates(), exports );
		};
	} else {
		new pl.type.Module( "os", predicates(), exports );
	}

})( pl );
