<g:uploadForm name="csvFileUploadForm" >
    <div class="card">
        <div class="card-body">
            The file must contain column headings, and must have at least one column called <code>imageUrl</code> which contains a url to an image. Data in other columns will be stored as metadata against the image.
        </div>
        <div>
            <label class="form-label" for="imagefile">Select a file</label>
            <div>
                <input type="file" name="csvfile" id="imagefile"/>
            </div>
        </div>
    </div>

    <div id="resultsDiv" style="display: none">

    </div>

    <div class="mb-3">
        <div class="controls">
            <button type="button" class="btn btn-outline-dark" id="btnCancelCSVFileUpload">Cancel</button>
            <button type="button" class="btn btn-primary" id="btnUploadCSVImagesFile">Upload</button>
        </div>
    </div>
    <script type="text/javascript">

        var progressIntervalId = 0;

        function updateProgress(batchId) {
            try {
                $.ajax("${createLink(action:'getBatchProgress')}?batchId=" + batchId).done(function (data) {
                    if (data.success) {
                        if (data.taskCount > 0 && data.taskCount == data.tasksCompleted) {
                            clearInterval(progressIntervalId);
                            $("#resultsDiv").html("Upload complete.");
                        } else {
                            $("#resultsDiv").html("Uploaded " + data.tasksCompleted + " of " + data.taskCount);
                        }
                    } else {
                        clearInterval(progressIntervalId);
                    }
                });
            } catch (e) {
                $("#resultsDiv").html("Error! " + e);
                clearInterval(progressIntervalId);
            }
        }

        function renderProgress(batchId) {
            progressIntervalId = setInterval(function() {
                updateProgress(batchId);
            }, 1000);
        }

        $("#btnCancelCSVFileUpload").click(function(e) {
            e.preventDefault();
            imglib.hideModal();
        });

        $("#btnUploadCSVImagesFile").click(function(e) {
            e.preventDefault();

            var formData = new FormData($("#csvFileUploadForm").get(0));

            if (formData) {
                $.ajax({
                    url: "${createLink(action:'uploadImagesFromCSVFile')}",
                    data: formData,
                    processData: false,
                    contentType: false,
                    type: 'POST'
                }).done(function(result) {
                    if (!result.success) {
                        $("#resultsDiv").html('<div class="alert alert-danger">' + result.message + '</div>').css("display", "block");
                    } else {
                        $("#resultsDiv").html('<div class="alert alert-success">' + result.message + '</div>').css("display", "block");
                        renderProgress(result.batchId);
                    }
                });
            }

        });

    </script>
</g:uploadForm>

