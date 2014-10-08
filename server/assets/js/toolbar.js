
$(function() {
    
    var overlay = new Overlay();
    
    $('#ak-editor-edit-button').click(function() {
        var akEditor = $("script.ak-editor-form-edit").html();
        overlay.append_content(akEditor);
        overlay.show();
    });

    $('#ak-editor-add-new-button').click(function() {
        var akEditor = $("script.ak-editor-form-add").html();
        overlay.append_content(akEditor);
        overlay.show();
    });

    $('#ak-editor-delete-button').click(function() {
        var akEditor = $("script.ak-editor-form-delete").html();
        overlay.append_content(akEditor);
        overlay.show();
    });

});