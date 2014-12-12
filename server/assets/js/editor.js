
$(function() {
    
    var breadcrumbs = {
    	setup: function() {
			if ($("#ak-editor-breadcrumbs").length > 0) {
				$("#ak-editor-breadcrumbs button").on('click', function(event) {
			
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
					editviewer.fileView(akpath);
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
    	fileView: function(akpath) {
			console.log("/..api/fileViewer"+ akpath);
			$.ajax({
				url: "/..api/fileViewer"+ akpath,
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
			
			$('#editFileModal #ak-editor-nav-tabs a').click(function (e) {
			  e.preventDefault()
			  $(this).tab('show')
			});
			
			$("#editFileModal #ak-editor-nav-tabs #modal-tab-link-page").on('shown.bs.tab', function (e) {
				console.log("#editFileModal #modal-link-page-area shown.bs.tab");
				editorModal.initModalEditorTabs();
			});
			$("#editFileModal #modal-tab-upload-file").on('shown.bs.tab', function (e) {
				console.log("#editFileModal #modal-tab-upload-file shown.bs.tab");
				editorModal.initModalFileUploadTab();
			});
			
        	$("#editFileModal #modal-upload-file-area form :button").on('click', editorModal.uploadFile);
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
                    editviewer.fileView(json.akpath);
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
                    editviewer.fileView(json.akpath);
                    sidebar.update(json.akpath);
                    breadcrumbs.update(json.akpath);
                },
                error: function(xhr, status, errorThrown) {
                    messages.display("ERROR "+ xhr.responseText);
                }
            });
		},
		initModalEditorTabs: function() {
			if ($("#editFileModal #modal-link-page-area #modal-breadcrumbs-link-page").hasClass("uninitialized")) {
				console.log("#editFileModal #modal-link-page-area #modal-breadcrumbs-link-page uninitialized");
				editorModal.updateModalEditorBreadcrumbsWidget("/", "#modal-link-page-area");
				editorModal.updateModalEditorSidebarWidget("/", "#modal-link-page-area");
			}
			if ($("#editFileModal #modal-upload-file-area #modal-breadcrumbs-upload-file").hasClass("uninitialized")) {
				console.log("#editFileModal #modal-upload-file-area #modal-breadcrumbs-upload-file uninitialized");
				editorModal.updateModalEditorBreadcrumbsWidget("/", "#modal-upload-file-area");
				editorModal.updateModalEditorSidebarWidget("/", "#modal-upload-file-area");
			}
		},
		updateModalEditorBreadcrumbsWidget: function(akpath, selector) {
			console.log("updateModalEditorUploadFileBreadcrumbs /..api/breadcrumbTrail"+ akpath);
			$.ajax({
				url: "/..api/breadcrumbTrail"+ akpath,
				type: "GET",
				dataType: "json",
				success: function(json) {
					$("#editFileModal "+ selector +" .pane-breadcrumbs-container ol")
						.empty()
						.append(json.html);
					$("#editFileModal "+ selector +" .pane-breadcrumbs-container")
						.attr("ak-path", json.akpath)
						.removeClass("uninitialized");
					
					editorModal.setupButtonsModalEditorBreadcrumbsWidget(json.akpath, selector);
				},
				error: function(xhr, status, errorThrown) {
					messages.display("ERROR "+ xhr.responseText);
				}
			});
			
		},
		setupButtonsModalEditorBreadcrumbsWidget: function(akpath, selector) {
			$("#editFileModal "+ selector +" .pane-breadcrumbs-container button").on('click', function(event) {
				console.log(selector +' breadcrumbs button click');

				event.preventDefault();
				
				var akpath = $(this).attr('ak-path');
				console.log(akpath);
	
				editorModal.clearViewerModalEditor(selector);
				editorModal.updateModalEditorBreadcrumbsWidget(akpath, selector);
				editorModal.updateModalEditorSidebarWidget(akpath, selector);
			});
		},
		updateModalEditorSidebarWidget: function(akpath, selector) {
			console.log("updateModalEditorSidebarWidget /..api/sidebarFilesList"+ akpath);
			$.ajax({
				url: "/..api/sidebarFilesList"+ akpath,
				type: "GET",
				dataType: "json",
				success: function(json) {
					$("#editFileModal "+ selector +" .pane-sidebar")
						.empty()
						.append(json.html)
						.attr("ak-path", json.akpath)
						.attr("dirpath", json.dirpath)
						.removeClass("uninitialized");
					
					editorModal.setupButtonsModalEditorSidebarWidget(json.akpath, selector);
				},
				error: function(xhr, status, errorThrown) {
					messages.display("ERROR "+ xhr.responseText);
				}
			});
		},
		setupButtonsModalEditorSidebarWidget: function(akpath, selector) {
			$('#editFileModal '+ selector +' span.label').on('click', function(event) {
	
				console.log(selector +' sidebar click');
		
				event.preventDefault();
				var akpath = $(this).attr('ak-path');
	
				console.log(akpath);
		
				editorModal.clearViewerModalEditor(selector);
				editorModal.updateModalEditorBreadcrumbsWidget(akpath, selector);
				editorModal.updateModalEditorSidebarWidget(akpath, selector);
				editorModal.showViewerModalEditor(akpath, selector);
			});
		},
		akpathModalEditorSidebar: function(selector) {
			return $("#editFileModal "+ selector +" .pane-sidebar").attr("ak-path");
		},
		dirpathModalEditorSidebar: function(selector) {
			return $("#editFileModal "+ selector +" .pane-sidebar").attr("dirpath");
		},
		clearViewerModalEditor: function(selector) {
			if (selector === "#modal-link-page-area") {
				$("#editFileModal "+ selector +" .pane-info-area").empty();
			} else if (selector === "#modal-upload-file-area") {
				// nothing to clear
			}
		},
		showViewerModalEditor: function(akpath, selector) {
			if (selector === "#modal-link-page-area") {
				console.log("/..api/showViewerModalEditorLinkPage"+ akpath);
				$.ajax({
					url: "/..api/showViewerModalEditorLinkPage"+ akpath,
					type: "GET",
					dataType: "json",
					success: function(json) {
						editorModal.clearViewerModalEditor("#modal-link-page-area");
						$("#editFileModal #modal-sidebar-link-page-info-area").append(json.html);
					},
					error: function(xhr, status, errorThrown) {
						messages.display("ERROR "+ xhr.responseText);
					}
				});
			} else if (selector === "#modal-upload-file-area") {
				// nothing to show 
			}
		},
		initModalFileUploadTab: function(event) {
			$("#editFileModal #modal-upload-file-area .modal-upload-urlpath")
				.val(editorModal.akpathModalEditorSidebar("#modal-upload-file-area"));
			$("#editFileModal #modal-upload-file-area .modal-upload-dirpath")
				.val(editorModal.dirpathModalEditorSidebar("#modal-upload-file-area"));
		},
		uploadFile: function(event) {
            $.ajax({
                url: "/..api/uploadFiles",
                type: "POST",
                data: new FormData($('#editFileModal #modal-upload-file-area form')[0]),
                cache: false,
				contentType: false,
				processData: false,
                success: function(json) {
					editorModal.updateModalEditorBreadcrumbsWidget(json.akpath, "#modal-upload-file-area");
					editorModal.updateModalEditorBreadcrumbsWidget(json.akpath, "#modal-link-page-area");
					editorModal.updateModalEditorSidebarWidget(json.akpath, "#modal-upload-file-area");
					editorModal.updateModalEditorSidebarWidget(json.akpath, "#modal-link-page-area");
					$('#editFileModal #modal-tab-link-page').tab('show');
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
    		$("#uploadFileModal").on('show.bs.modal', buttons.initializeUploadFileModal);
        	$("#uploadFileModal form :button").on('click', buttons.uploadFileModal);
    	},
    	addNewDirectory: function(event) {
			$("#newDirectoryModal").modal('hide');
			$.ajax({
				url: "/..api/addnewdir",
				type: "POST",
				data: {
					urlpath: sidebar.dirpath(),
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
		},
		initializeUploadFileModal: function(event) {
			$("#ak-editor-upload-urlpath").val(sidebar.akpath());
			$("#ak-editor-upload-dirpath").val(sidebar.dirpath());
		},
		uploadFileModal: function(event) {
			$("#uploadFileModal").modal('hide');
            $.ajax({
                url: "/..api/uploadFiles",
                type: "POST",
                data: new FormData($('#uploadFileModal form')[0]),
                cache: false,
				contentType: false,
				processData: false,
                success: function(json) {
					breadcrumbs.update(json.akpath);
					sidebar.update(json.akpath);
					// TBD make sure editviewer shows the file
					editviewer.fileView(json.akpath);
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

});