package images.client.plugin

import au.org.ala.web.AuthService
import grails.converters.JSON
import grails.converters.XML
import org.apache.commons.httpclient.HttpStatus
import org.apache.http.entity.ContentType
import org.springframework.web.multipart.MultipartFile
import org.springframework.web.multipart.MultipartRequest

class ImageClientController {

    def imagesWebService
    def speciesListWebService
    def bieWebService
    AuthService authService

    def createSubImage(){
        [userId: authService.getUserId()]
    }

    def calibrateImage(){
        [userId: authService.getUserId()]
    }

    def uploadFromCSVFragment() {
    }

    def uploadImagesFromCSVFile() {
        // it should contain a file parameter
        MultipartRequest req = request as MultipartRequest
        if (req) {
            MultipartFile file = req.getFile('csvfile')
            if (!file || file.size == 0) {
                renderResults([success: false, message: 'File not supplied or is empty. Please supply a filename.'])
                return
            }

            // need to convert the csv file into a list of maps...
            int lineCount = 0
            def headers = []
            def batch = []

            file.inputStream.eachCsvLine { tokens ->
                if (lineCount == 0) {
                    headers = tokens
                } else {
                    def m = [:]
                    for (int i = 0; i < headers.size(); ++i) {
                        m[headers[i]] = tokens[i]
                    }
                    batch << m
                }
                lineCount++
            }

            def results = imagesWebService.scheduleImagesUpload(batch)
            renderResults(results)
        } else {
            renderResults([success: false, message: "Expected multipart request containing 'csvfile' file parameter"])
        }

    }

    def getBatchProgress() {
        renderResults(imagesWebService.getBatchStatus(params.batchId))
    }

    private renderResults(Object results, int responseCode = 200) {

        withFormat {
            json {
                def jsonStr = results as JSON
                if (params.callback) {
                    render("${params.callback}(${jsonStr})")
                } else {
                    render(jsonStr)
                }
            }
            xml {
                render(results as XML)
            }
        }
        response.addHeader("Access-Control-Allow-Origin", "")
        response.status = responseCode
    }

    def userRating(){
        String userId = authService.getUserId()
        if(params.id && userId){
            Map result = imagesWebService.userRating(params.id, userId)
            if(!result.error){
                render text: result as grails.converters.JSON, contentType: ContentType.APPLICATION_JSON
            } else {
                render text: "An error occurred while looking up information", status: HttpStatus.SC_INTERNAL_SERVER_ERROR
            }
        } else {
            render text: "You must be logged in and image id must be provided.", status: HttpStatus.SC_BAD_REQUEST
        }
    }

    def getPreferredSpeciesImageList() {
        try {
            def list = speciesListWebService.getPreferredImageSpeciesList()
            if (!list) {
                list = new ArrayList<String>()
            }
            render text: list as grails.converters.JSON, contentType: ContentType.APPLICATION_JSON
        } catch (Exception ex) {
            log.error("An error occurred while getting the preferred species image list", ex)
            render text: "An error occurred while getting the preferred species image list.", status: HttpStatus.SC_INTERNAL_SERVER_ERROR
        }
    }

    def saveImageToSpeciesList() {
        def result = [:]
        String userId = authService.getUserId()
        if (!userId) {
            render status: HttpStatus.SC_BAD_REQUEST, text: "You must be logged in"
        } else {
            if (params.id && params.scientificName) {
                result = speciesListWebService.saveImageToSpeciesList(params.scientificName, params.family, params.id)
                if (result.status == HttpStatus.SC_OK || result.status == HttpStatus.SC_CREATED || result.status == HttpStatus.SC_ACCEPTED) {
                    result = bieWebService.updateBieIndex(result.data)
                }
            } else {
                result = [status: HttpStatus.SC_BAD_REQUEST, text: "Save image to species list failed. Missing parameter id or scientific name. This should not happen. Please refresh and try again."]
            }
        }
        render text: result as grails.converters.JSON, contentType: ContentType.APPLICATION_JSON
    }

    def likeImage() {
        String userId = authService.getUserId()
        if(params.id && userId){
            Map result = imagesWebService.likeOrDislikeImage('LIKE', params.id, userId)
            if(!result.error){
                render text: result as grails.converters.JSON, contentType: ContentType.APPLICATION_JSON
            } else {
                render text: "An error occurred while saving metadata to image", status: HttpStatus.SC_INTERNAL_SERVER_ERROR
            }
        } else {
            render text: "You must be logged in and image id must be provided.", status: HttpStatus.SC_BAD_REQUEST
        }
    }

    def dislikeImage() {
        String userId = authService.getUserId()
        if(params.id && userId){
            Map result = imagesWebService.likeOrDislikeImage('DISLIKE', params.id, userId)
            if(!result.error){
                render text: result as grails.converters.JSON, contentType: ContentType.APPLICATION_JSON
            } else {
                render text: "An error occurred while saving metadata to image", status: HttpStatus.SC_INTERNAL_SERVER_ERROR
            }
        } else {
            render text: "You must be logged in and image id must be provided.", status: HttpStatus.SC_BAD_REQUEST
        }
    }

}
