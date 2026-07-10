<div>
    <p id="mandatoryFieldsRequest">Please supply a title and description</p>
    <div>
        <form>
            <div class="mb-3">
                <label for="title" class="form-label">
                    Title*
                </label>
                <input id="title" type="text" class="form-control" name="title" value=""/>
            </div>

            <div class="mb-3">
                <label for="description" class="form-label">
                    Description*
                </label>
                <input id="description" type="text" class="form-control" name="description" value=""/>
            </div>
        </form>
        <div>
            <button class="btn btn-outline-dark" id="btnCancelSubimage">Cancel</button>
            <button class="btn btn-primary" id="btnCreateSubimage2">Create subimage</button>
        </div>
    </div>
    <script type="text/javascript">

        $("#btnCancelSubimage").click(function(e) {
            e.preventDefault();
            imgvwr.hideModal();
        });

        $("#btnCreateSubimage2").click(function(e) {
            e.preventDefault();

            if ($('#description').val().length == 0 || $('#title').val().length == 0){
                $('#mandatoryFieldsRequest').addClass('alert alert-danger');
            } else {
                var baseUrl = imgvwr.getImageServiceBaseUrl()
                // Remove trailing slash if exists
                if (baseUrl.endsWith('/')) {
                    baseUrl = baseUrl.slice(0, -1);
                }
                var url = baseUrl + "/ws/createSubimage?id=${params.id}&x=${params.x}&y=${params.y}&width=${params.width}&height=${params.height}&userId=${userId}&description=" + encodeURIComponent($('#description').val()) + "&title=" + encodeURIComponent($('#title').val());
                $.ajax(url).done(function (results) {
                    if (results.success) {
                        imgvwr.hideModal();
                        imgvwr.showSubimages();
                        <g:if test="${params.callback}">
                        ${params.callback}();
                        </g:if>

                    } else {
                        alert("Failed to create sub image: " + results.message);
                    }
                }).fail(function(data){
                    $('#mandatoryFieldsRequest').html('Please re-login to create a subimage');
                    $('#mandatoryFieldsRequest').addClass('alert alert-danger');
                });
            }
        });
    </script>
</div>

