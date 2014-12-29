
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
				url: "/..api/breadcrumbTrail",
				type: "GET",
				data: {
					akpath: akpath
				},
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
				url: "/..api/sidebarFilesList", // + akpath,
				type: "GET",
				data: {
					akpath: akpath
				},
				dataType: "json",
				success: function(json) {
					$("#ak-editor-files-sidebar")
						.empty()
						.append(json.html)
						.attr("ak-path", json.akpath)
						.attr("dirpath", json.dirpath);
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
				url: "/..api/fileViewer",
				type: "GET",
				data: {
					akpath: akpath
				},
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

    		$("#editFileModal").on('show.bs.modal', editorModal.initializeFileEditModal);
			$("#editFileSave").on('click', editorModal.saveEditedFile);
			
			$('#editFileModal #ak-editor-nav-tabs a').click(function (e) {
			  e.preventDefault()
			  $(this).tab('show')
			});
			
			$("#editFileModal #ak-editor-nav-tabs .modal-editor-tab").on('shown.bs.tab', function (e) {
				console.log("#editFileModal #modal-link-page-area shown.bs.tab");
				editorModal.initModalEditorTabs();
			});
			$("#editFileModal #modal-tab-upload-file").on('shown.bs.tab', function (e) {
				console.log("#editFileModal #modal-tab-upload-file shown.bs.tab");
				editorModal.initModalFileUploadTab();
			});
			
        	$("#editFileModal #modal-upload-file-area form :button").on('click', editorModal.uploadFile);
    	},
		initializeFileEditModal: function(event) {
			var button = $(event.relatedTarget);
			var mode = button.data('mode');
			console.log('initializeFileEditModal '+ mode +' '+ breadcrumbs.akpath());
			if (mode === "create") {
				$("#editFileModal").removeClass("edit").addClass("create");
				$("#editFileModal #ak-edit-editor-pathname-inputs").show();
				$("#editFileModalLabel").text("Create new file");
				$("#ak-editor-add-dirname").text(sidebar.dirpath());
				$("#ak-editor-pathname-input").val("");
				editorModal.metaeditorEdit.setValue("", 0);
				editorModal.contenteditorEdit.setValue("", 0);
			} else if (mode === "edit") {
				$("#editFileModal").removeClass("create").addClass("edit");
				$("#editFileModal #ak-edit-editor-pathname-inputs").hide();
				$("#ak-editor-edit-dirname").text(breadcrumbs.akpath());
				$.ajax({
					url: "/..api/docData",
					type: "GET",
					data: {
						akpath: breadcrumbs.akpath()
					},
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
			}
		},
		saveEditedFile: function(event) {
			var button = $(event.relatedTarget);
			var mode;
			if ($("#editFileModal").hasClass("edit")) mode = "edit";
			else if ($("#editFileModal").hasClass("create")) mode = "create";
			$("#editFileModal").modal('hide');
			console.log('saveEditedFile mode='+ mode);
			if (mode === "create") {
				$.ajax({
					url: "/..api/saveNewFile",
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
			} else if (mode === "edit") {
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
            }
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
				url: "/..api/breadcrumbTrail",
				type: "GET",
				data: {
					akpath: akpath
				},
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
				url: "/..api/sidebarFilesList",
				type: "GET",
				data: {
					akpath: akpath
				},
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
					url: "/..api/showViewerModalEditorLinkPage",
					type: "GET",
					data: {
						akpath: akpath
					},
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
			editorModal.initModalFileUploadTab();
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
					editorModal.showViewerModalEditor(json.akpath, "#modal-link-page-area");
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
    
    var spinnerNext = function(span) {
    	if ($(span).hasClass('glyphicon-circle-arrow-left')) {
    		$(span).removeClass('glyphicon-circle-arrow-left');
    		$(span).addClass('glyphicon-circle-arrow-down');
    	} else if ($(span).hasClass('glyphicon-circle-arrow-down')) {
    		$(span).removeClass('glyphicon-circle-arrow-down');
    		$(span).addClass('glyphicon-circle-arrow-right');
    	} else if ($(span).hasClass('glyphicon-circle-arrow-right')) {
    		$(span).removeClass('glyphicon-circle-arrow-right');
    		$(span).addClass('glyphicon-circle-arrow-up');
    	} else if ($(span).hasClass('glyphicon-circle-arrow-up')) {
    		$(span).removeClass('glyphicon-circle-arrow-up');
    		$(span).addClass('glyphicon-circle-arrow-left');
    	}
    };
    
    var rebuildSite = {
    	setup: function() {
    		$("#rebuildSiteModal").on('show.bs.modal', rebuildSite.initializeRebuildSiteModal);
    		$("#rebuildSiteModal").on('hidden.bs.modal', rebuildSite.hiddenRebuildSiteModal);
    	},
    	source: undefined,
    	initializeRebuildSiteModal: function(e) {
    		console.log('rebuildSite.initializeRebuildSiteModal');
    		
    		$("#rebuildSiteModal .modal-body pre").empty();
    		
    		rebuildSite.source = new EventSource('/..stream-logs');
    		
			rebuildSite.source.addEventListener('message', function(ev) {
				/* var msgs = $("#rebuildSiteModal .modal-body pre").text().split('\n');
				msgs.push(ev.data);
				while(msgs.length >= 150) msgs.shift(); */
				$("#rebuildSiteModal .modal-body pre").append(ev.data + '\n');
				// spinnerNext("#rebuildSiteModal .modal-body span.spinner");
			});
			
			rebuildSite.source.addEventListener('error', function(ev) {
				/* var msgs = $("#rebuildSiteModal .modal-body pre").text().split('\n');
				msgs.push('ERROR: '+ ev.data);
				while(msgs.length >= 150) msgs.shift(); */
				$("#rebuildSiteModal .modal-body pre").append('ERROR: '+ ev.data +'\n');
				// spinnerNext("#rebuildSiteModal .modal-body span.spinner");
			});
			
            $.ajax({
                url: "/..api/fullbuild",
                type: "GET",
                data: null,
                cache: false,
				contentType: false,
				processData: false,
                success: function(json) {
    				console.log('rebuildSite.initializeRebuildSiteModal SUCCESS');
                	if (rebuildSite.source) rebuildSite.source.close();
                	rebuildSite.source = undefined;
                },
                error: function(xhr, status, errorThrown) {
    				console.log('rebuildSite.initializeRebuildSiteModal ERROR');
                    messages.display("ERROR "+ xhr.responseText);
                }
            });
    	},
    	hiddenRebuildSiteModal: function(e) {
    		if (rebuildSite.source) {
				rebuildSite.source.close();
				rebuildSite.source = undefined;
    		}
    	}
    };
    
    var deploySite = {
    	setup: function() {
    		$("#deploySiteModal").on('show.bs.modal', deploySite.initializeDeploySiteModal);
    		$("#deploySiteModal").on('hidden.bs.modal', deploySite.hiddenDeploySiteModal);
    	},
    	source: undefined,
    	initializeDeploySiteModal: function(e) {
    		console.log('deploySite.initializeDeploySiteModal');
    		
    		$("#deploySiteModal .modal-body pre").empty();
    		
    		deploySite.source = new EventSource('/..stream-logs');
    		
			deploySite.source.addEventListener('message', function(ev) {
				$("#deploySiteModal .modal-body pre").append(ev.data + '\n');
			});
			
			deploySite.source.addEventListener('error', function(ev) {
				$("#deploySiteModal .modal-body pre").append('ERROR: '+ ev.data +'\n');
			});
			
            $.ajax({
                url: "/..api/deploysite",
                type: "GET",
                data: null,
                cache: false,
				contentType: false,
				processData: false,
                success: function(json) {
    				console.log('deploySite.initializeDeploySiteModal SUCCESS');
                	if (deploySite.source) deploySite.source.close();
                	deploySite.source = undefined;
                },
                error: function(xhr, status, errorThrown) {
    				console.log('deploySite.initializeDeploySiteModal ERROR');
                    messages.display("ERROR "+ xhr.responseText);
                }
            });
    	},
    	hiddenDeploySiteModal: function(e) {
    		if (deploySite.source) {
				deploySite.source.close();
				deploySite.source = undefined;
    		}
    	}
    };
    
    breadcrumbs.setup();
    sidebar.setup();
    editviewer.setup();
    messages.setup();
    buttons.setup();
    editorModal.setup();
	rebuildSite.setup();
	deploySite.setup();
});