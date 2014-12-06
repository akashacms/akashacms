
$(function() {
    
    /*var Yeditor;
    var Ceditor;
    
    if ($("#ak-editor-metadata-input").length > 0) {
        Yeditor = ace.edit("ak-editor-metadata-input");
        Yeditor.setTheme("ace/theme/monokai");
        Yeditor.getSession().setMode("ace/mode/yaml");
    }
    if ($("#ak-editor-content-input").length > 0) {
        Ceditor = ace.edit("ak-editor-content-input");
        Ceditor.setTheme("ace/theme/monokai");
        Ceditor.getSession().setMode("ace/mode/markdown");
    }*/
    
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
					breadcrumbs.setup();
				},
				error: function(xhr, status, errorThrown) {
					messages.display("ERROR "+ xhr.responseText);
				}
			});
		}
    };
    
    var messages = {
    	setup: function() {
    		$("#ak-editor-messages button").on('click', function(event) {
    			messages.clear();
    			messages.hide();
    		});
    		messages.hide();
    	},
    	display: function(msg) {
    		messages.clear();
    		messages.show();
			$("#ak-editor-messages").text("ERROR "+ xhr.responseText);
    	},
    	clear: function() {
			$("#ak-editor-messages").empty();
		},
		hide: function() {
			$("#ak-editor-messages").hide();
		},
		show: function() {
			$("#ak-editor-messages").show();
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
					sidebar.setup();
				},
				error: function(xhr, status, errorThrown) {
					messages.display("ERROR "+ xhr.responseText);
				}
			});
		}
    };
    
    // Need other UI elements to check the page editor to see about unsaved changes
    // and prompt the user to save them on certain events
    
    var editviewer = {
    	setup: function() {
			$(document).ready(editviewer.resizer);
			$(window).resize(editviewer.resizer);
    	},
    	setupPageEditor: function(akpath) {
    		if ($("#ak-page-editor-frame").length > 0) {
    			$("ak-page-editor-frame").hide();
    			$("#ak-edit-view-button").on('click', function(event) {
    				editviewer.showPageViewer();
    			});
    			$("#ak-edit-edit-button").on('click', function(event) {
    				editviewer.showPageEditor(akpath);
    			});
    			$("#ak-edit-delete-button").on('click', function(event) {
    				// TBD editviewer.showPageEditor();
    			});
    			
				if ($("#ak-editor-metadata-input").length > 0) {
					editviewer.metaeditor = ace.edit("ak-editor-metadata-input");
					editviewer.metaeditor.setTheme("ace/theme/monokai");
					editviewer.metaeditor.getSession().setMode("ace/mode/yaml");
				}
				if ($("#ak-editor-content-input").length > 0) {
					editviewer.contenteditor = ace.edit("ak-editor-content-input");
					editviewer.contenteditor.setTheme("ace/theme/monokai");
					editviewer.contenteditor.getSession().setMode("ace/mode/markdown");
				}
    		}
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
					editviewer.setupPageEditor(akpath);
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
		showPageEditor: function(akpath) {
			$("#ak-editor-editor-area iframe").hide();
			$("#ak-editor-editor-area #ak-page-editor-frame").show();
			if ($("#ak-editor-editor-area #ak-page-editor-frame").hasClass("uninitialized")) {
				$.ajax({
					url: "/..api/docData"+ akpath,
					type: "GET",
					dataType: "json",
					success: function(json) {
						editviewer.metaeditor.setValue(json.metadata);
						editviewer.contenteditor.setValue(json.content);
						$("#ak-editor-editor-area #ak-page-editor-frame").removeClass("uninitialized");
					},
					error: function(xhr, status, errorThrown) {
						$("#ak-editor-message-area").text("ERROR "+ status +" "+ errorThrown);
					}
				});
			}
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
    
    var buttons = {
    	newFile: function() {
    	},
    	newDirectory: function() {
    	}
    };
    
    breadcrumbs.setup();
    sidebar.setup();
    editviewer.setup();
    messages.setup();
    
    
    if ($(".ak-adddir-form").length > 0) {
    	$(".ak-adddir-form").submit(function(event) {
    		event.preventDefault();
    		$.ajax({
    			url: "/..admin/adddir",
    			type: "POST",
    			data: {
                    urlpath: $("#ak-adddir-urlpath").attr("value"),
                    dirname: $("#ak-adddir-add-dirname").length > 0 ? $("#ak-adddir-add-dirname").text() : "",
                    pathname: $("#ak-adddir-pathname-input").length > 0 ? $("#ak-adddir-pathname-input").val() : "",
    			},
                dataType: "json",
                success: function(json) {
                    window.location = json.newlocation;
                },
                error: function(xhr, status, errorThrown) {
                    $("#ak-adddir-message-area").text("ERROR "+ xhr.responseText);
                }
    		});
    	});
    }
    
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