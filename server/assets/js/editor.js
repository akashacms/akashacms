
$(function() {
    
    var breadcrumbs = {
    	setup: function() {
			if ($("#ak-editor-breadcrumbs").length > 0) {
				$("#ak-editor-breadcrumbs button").on('click', function(event) {
					/*
					DONE decide which directory to load
					DONE rejigger breadcrumbs for that directory
					DONE rejigger sidebar for that directory
					if viewing something - close that view
					if the result needs to view something, then cause it to view */
			
					console.log('ak-editor-breadcrumbs button click');
			
					event.preventDefault();
					// get ak-path from the button clicked on
					var akpath = $(this).attr('ak-path');
			
					console.log(akpath);
				
					editviewer.clear();
					breadcrumbs.update(akpath);
					sidebar.update(akpath);
				});
			}
		},
    	update: function(akpath) {
			console.log("/..api/breadcrumbTrail"+ akpath);
			$.ajax({
				url: "/..api/breadcrumbTrail"+ akpath,
				type: "GET",
				dataType: "json",
				success: function(json) {
					$("#ak-editor-breadcrumbs ol").empty();
					$("#ak-editor-breadcrumbs ol").append(json.html);
					$("#ak-editor-breadcrumbs").attr("ak-path", json.akpath);
					breadcrumbs.setup();
				},
				error: function(xhr, status, errorThrown) {
					messages.display("ERROR "+ xhr.responseText);
				}
			});
		},
		akpath: function() {
			return $("#ak-editor-breadcrumbs").attr("ak-path");
		}
    };
    
    var messages = {
    	setup: function() {
    		$("#ak-editor-messages-area button").on('click', function(event) {
    			messages.clear();
    			messages.hide();
    		});
    		messages.hide();
    	},
    	display: function(msg) {
    		messages.clear();
    		messages.show();
			$("#ak-editor-messages").text(msg);
    	},
    	clear: function() {
			$("#ak-editor-messages").empty();
		},
		hide: function() {
			$("#ak-editor-messages-area").hide();
		},
		show: function() {
			$("#ak-editor-messages-area").show();
		}
    };
    
    var sidebar = {
    	setup: function() {
			if ($('#ak-editor-files-sidebar').length > 0) {
				$('#ak-editor-files-sidebar span.label').on('click', function(event) {
			
					console.log('ak-editor-files-sidebar span.label click');
				
					event.preventDefault();
					var akpath = $(this).attr('ak-path');
			
					console.log(akpath);
				
					editviewer.clear();
					breadcrumbs.update(akpath);
					sidebar.update(akpath);
				
					if ($(this).hasClass("image")) {
						editviewer.image(akpath);
					} else if ($(this).hasClass("editable")) {
						editviewer.page(akpath);
					}
				});
			}
		},
    	update: function(akpath) {
			console.log("/..api/sidebarFilesList"+ akpath);
			$.ajax({
				url: "/..api/sidebarFilesList"+ akpath,
				type: "GET",
				dataType: "json",
				success: function(json) {
					$("#ak-editor-files-sidebar").empty();
					$("#ak-editor-files-sidebar").append(json.html);
					$("#ak-editor-files-sidebar").attr("ak-path", json.akpath);
					$("#ak-editor-files-sidebar").attr("dirpath", json.dirpath);
					sidebar.setup();
				},
				error: function(xhr, status, errorThrown) {
					messages.display("ERROR "+ xhr.responseText);
				}
			});
		},
		akpath: function() {
			return $("#ak-editor-files-sidebar").attr("ak-path");
		},
		dirpath: function() {
			return $("#ak-editor-files-sidebar").attr("dirpath");
		}
    };
    
    // Need other UI elements to check the page editor to see about unsaved changes
    // and prompt the user to save them on certain events
    
    var editviewer = {
    	setup: function() {
			$(document).ready(editviewer.resizer);
			$(window).resize(editviewer.resizer);
    	},
    	clear: function() {
			$("#ak-editor-editor-area").empty();
    	},
    	image: function(akpath) {
			console.log("/..api/imageViewer"+ akpath);
			$.ajax({
				url: "/..api/imageViewer"+ akpath,
				type: "GET",
				dataType: "json",
				success: function(json) {
					editviewer.clear();
					$("#ak-editor-editor-area").append(json.html);
				},
				error: function(xhr, status, errorThrown) {
					messages.display("ERROR "+ xhr.responseText);
				}
			});
    	},
    	page: function(akpath) {
			console.log("/..api/pageViewer"+ akpath);
			$.ajax({
				url: "/..api/pageViewer"+ akpath,
				type: "GET",
				dataType: "json",
				success: function(json) {
					editviewer.clear();
					$("#ak-editor-editor-area").append(json.html);
				},
				error: function(xhr, status, errorThrown) {
					messages.display("ERROR "+ xhr.responseText);
				}
			});
		},
		showPageViewer: function() {
			$("#ak-editor-editor-area iframe").show();
			$("#ak-editor-editor-area #ak-page-editor-frame").hide();
		},
		resizer: function() {
			var height = $("ak-editor-main-area").height();
			$("#ak-editor-editor-area").height(height);
			if ($("#ak-editor-editor-area iframe").length > 0) {
				var h2 = $("#ak-edit-pageview-buttons").height();
				$("#ak-editor-editor-area iframe").height(height - h2);
			}
		}
    };
    
    var editorModal = {
    	setup: function() {
			if ($("#ak-editor-new-metadata-input").length > 0) {
				editorModal.metaeditorNew = ace.edit("ak-editor-new-metadata-input");
				editorModal.metaeditorNew.setTheme("ace/theme/monokai");
				editorModal.metaeditorNew.getSession().setMode("ace/mode/yaml");
			}
			if ($("#ak-editor-new-content-input").length > 0) {
				editorModal.contenteditorNew = ace.edit("ak-editor-new-content-input");
				editorModal.contenteditorNew.setTheme("ace/theme/monokai");
				editorModal.contenteditorNew.getSession().setMode("ace/mode/markdown");
			}

			if ($("#ak-editor-edit-metadata-input").length > 0) {
				editorModal.metaeditorEdit = ace.edit("ak-editor-edit-metadata-input");
				editorModal.metaeditorEdit.setTheme("ace/theme/monokai");
				editorModal.metaeditorEdit.getSession().setMode("ace/mode/yaml");
			}
			if ($("#ak-editor-edit-content-input").length > 0) {
				editorModal.contenteditorEdit = ace.edit("ak-editor-edit-content-input");
				editorModal.contenteditorEdit.setTheme("ace/theme/monokai");
				editorModal.contenteditorEdit.getSession().setMode("ace/mode/markdown");
			}

    		$("#newFileModal").on('show.bs.modal', editorModal.initializeFileCreateModal);
			$("#newFileSave").on('click', editorModal.saveNewFile);
    		$("#editFileModal").on('show.bs.modal', editorModal.initializeFileEditModal);
			$("#editFileSave").on('click', editorModal.saveEditedFile);
    	},
		initializeFileCreateModal: function() {
			$("#ak-editor-add-dirname").text(sidebar.dirpath());
			$("#ak-editor-pathname-input").val("");
			editorModal.metaeditorNew.setValue("", 0);
			editorModal.contenteditorNew.setValue("", 0);
		},
		initializeFileEditModal: function() {
			console.log('initializeFileEditModal '+ breadcrumbs.akpath());
			$("#ak-editor-edit-dirname").text(breadcrumbs.akpath());
			$.ajax({
				url: "/..api/docData"+ breadcrumbs.akpath(),
				type: "GET",
				dataType: "json",
				success: function(json) {
					console.log('initializeFileEditModal success');
					editorModal.metaeditorEdit.setValue(json.metadata);
					editorModal.contenteditorEdit.setValue(json.content);
				},
				error: function(xhr, status, errorThrown) {
					messages.display("ERROR "+ status +" "+ errorThrown);
				}
			});
		},
		saveNewFile: function() {
			$("#newFileModal").modal('hide');
            $.ajax({
                url: "/..api/saveNewFile",
                type: "POST",
                data: {
                    metadata: editorModal.metaeditorNew.getValue(),
                    content: editorModal.contenteditorNew.getValue(),
                    urlpath: breadcrumbs.akpath(),
                    dirname: $("#ak-editor-add-dirname").text(),
                    pathname: $("#ak-editor-pathname-input").val(),
                    fnextension: $("#ak-editor-fnextension").val()
                },
                dataType: "json",
                success: function(json) {
                    editviewer.page(json.akpath);
                    sidebar.update(json.akpath);
                    breadcrumbs.update(json.akpath);
                },
                error: function(xhr, status, errorThrown) {
                    messages.display("ERROR "+ xhr.responseText);
                }
            });
		},
		saveEditedFile: function() {
			$("#editFileModal").modal('hide');
            $.ajax({
                url: "/..api/saveEditedFile",
                type: "POST",
                data: {
                    metadata: editorModal.metaeditorEdit.getValue(),
                    content: editorModal.contenteditorEdit.getValue(),
                    urlpath: breadcrumbs.akpath(),
                    dirname: $("#ak-editor-add-dirname").text(),
                    pathname: $("#ak-editor-pathname-input").val(),
                    fnextension: $("#ak-editor-fnextension").val()
                },
                dataType: "json",
                success: function(json) {
                    editviewer.page(json.akpath);
                    sidebar.update(json.akpath);
                    breadcrumbs.update(json.akpath);
                },
                error: function(xhr, status, errorThrown) {
                    messages.display("ERROR "+ xhr.responseText);
                }
            });
		}
    };
    
    var buttons = {
    	setup: function() {
    		$("#newDirectorySave").on('click', buttons.addNewDirectory);
    		buttons.setupDeleteFileButtons();
    	},
    	addNewDirectory: function(event) {
			$("#newDirectoryModal").modal('hide');
			$.ajax({
				url: "/..api/addnewdir",
				type: "POST",
				data: {
					urlpath: breadcrumbs.akpath(),
					pathname: $('#ak-adddir-pathname-input').val(),
				},
				dataType: "json",
				success: function(json) {
					breadcrumbs.update(json.akpath);
					sidebar.update(json.akpath);
    				$("#ak-adddir-pathname-input").val("");
				},
				error: function(xhr, status, errorThrown) {
					messages.display("ERROR "+ xhr.responseText);
				}
			});
		},
		setupDeleteFileButtons: function() {
    		$("#deleteFileModal").on('show.bs.modal', buttons.initializeDeleteFileModal);
    		$("#deleteFileConfirm").on('click', buttons.deleteFileConfirm);
		},
		initializeDeleteFileModal: function(event) {
			$("#ak-delete-file-name").text(breadcrumbs.akpath());
		},
		deleteFileConfirm: function(event) {
			console.log('deleteFileConfirm '+ breadcrumbs.akpath());
			$("#deleteFileModal").modal('hide');
			$.ajax({
				url: "/..api/deleteFileConfirm",
				type: "POST",
				data: {
					urlpath: breadcrumbs.akpath()
				},
				dataType: "json",
				success: function(json) {
					// console.log('deleteFileConfirm success akpath='+ json.akpath);
					breadcrumbs.update(json.akpath);
					sidebar.update(json.akpath);
					editviewer.clear();
				},
				error: function(xhr, status, errorThrown) {
					messages.display("ERROR "+ xhr.responseText);
				}
			});
		}
    };
    
    breadcrumbs.setup();
    sidebar.setup();
    editviewer.setup();
    messages.setup();
    buttons.setup();
    editorModal.setup();
    
    
    if ($(".ak-editor-addedit-form").length > 0) {
    
    	if ($(".ak-editor-addedit-form[id='ak-editor-edit-form']").length > 0) {
			$.ajax({
				url: "/..api/docData"+ $("#ak-editor-urlpath").attr("value"),
				type: "GET",
				dataType: "json",
				success: function(json) {
					Yeditor.setValue(json.metadata);
					Ceditor.setValue(json.content);
				},
				error: function(xhr, status, errorThrown) {
					$("#ak-editor-message-area").text("ERROR "+ status +" "+ errorThrown);
				}
			});
    	}
    
        $(".ak-editor-addedit-form").submit(function(event) {
            event.preventDefault();
            $.ajax({
                url: $(this).attr('id') === "ak-editor-edit-form" ? "/..admin/edit" : "/..admin/add",
                type: "POST",
                data: {
                    metadata: Yeditor.getValue(),
                    content: Ceditor.getValue(),
                    urlpath: $("#ak-editor-urlpath").attr("value"),
                    dirname: $("#ak-editor-add-dirname").length > 0 ? $("#ak-editor-add-dirname").text() : "",
                    pathname: $("#ak-editor-pathname-input").length > 0 ? $("#ak-editor-pathname-input").val() : "",
                    fnextension: $("#ak-editor-fnextension").length > 0 ? $("#ak-editor-fnextension").val()	: ""
                },
                dataType: "json",
                success: function(json) {
                    window.location = json.newlocation;
                },
                error: function(xhr, status, errorThrown) {
                    $("#ak-editor-message-area").text("ERROR "+ xhr.responseText);
                }
            });
        });
    }
});