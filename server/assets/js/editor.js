
$(function() {
    
    // var overlay = new Overlay();
    
    /*$('#ak-editor-edit-button').click(function() {
        var akEditor = $("script.ak-editor-form-edit").html();
        overlay.append_content(akEditor);
        overlay.show();
    });*/

    /*if ($("#ak-editor-add-new-button").length > 0) {
        $('#ak-editor-add-new-button').click(function() {
            var akEditor = $("script.ak-editor-form-add").html();
            overlay.append_content(akEditor);
            overlay.show();
        });
    }

    if ($("#ak-editor-add-delete-button").length > 0) {
        $('#ak-editor-delete-button').click(function() {
            var akEditor = $("script.ak-editor-form-delete").html();
            overlay.append_content(akEditor);
            overlay.show();
        });
    }*/

    var Yeditor;
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
    }
    
    /*if ($("#ak-editor-edit-form").length > 0) {
        $("#ak-editor-edit-form").submit(function(event) {
            event.preventDefault();
            $.ajax({
                url: "/..admin/edit",
                type: "POST",
                data: {
                    metadata: Yeditor.getValue(),
                    content: Ceditor.getValue(),
                    urlpath: $("#ak-editor-urlpath").attr("value")
                },
                dataType: "json",
                success: function(json) {
                    window.location = json.newlocation;
                },
                error: function(xhr, status, errorThrown) {
                    $("#ak-editor-message-area").text("ERROR "+ status +" "+ errorThrown);
                }
            });
        });
    }*/
    
    if ($(".ak-editor-addedit-form").length > 0) {
    
    	if ($(".ak-editor-addedit-form[id='ak-editor-edit-form']").length > 0) {
			$.ajax({
				url: "/..admin/docData"+ $("#ak-editor-urlpath").attr("value"),
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