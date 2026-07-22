package images.client.plugin

import groovy.json.JsonBuilder
import groovy.json.JsonSlurper
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType

import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets
import java.time.Duration

class ImagesWebService {

    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build()

    def grailsApplication

    private String getServiceUrl() {
        def url = grailsApplication.config.getProperty('ala.image.service.url', String, "http://devt.ala.org.au:8080/ala-images")
        if (!url.endsWith("/")) {
            url += "/"
        }
        return url
    }

    public Map scheduleImagesUpload(List<Map> images) {
        def url = "${serviceUrl}ws/scheduleUploadFromUrls"
        def results = postJSON(url, [images: images])
        if (results && results.status == 200) {
            return results.content
        } else {
            throw new RuntimeException("Upload failed! ${results}")
        }
    }

    def getBatchStatus(String batchId) {
        def url = "${serviceUrl}ws/getBatchStatus?batchId=" + batchId
        def results = getJSON(url)
        return results
    }

    public Map getImageInfo(List images) {

        def url = "${serviceUrl}ws/findImagesByOriginalFilename"
        def filenameList = images*.sourceUrl

        def results = postJSON(url, [filenames: filenameList])

        if (results.status == 200) {
            def resultsMap = results.content.results
            def map = [:]
            images.each { img ->

                def imgResults = resultsMap[img.sourceUrl]
                if (imgResults && imgResults.count > 0) {
                    map[img.sourceUrl] = imgResults.images[0]
                }
            }
            return map
        } else {
            println results
        }
        return null
    }

    def getJSON(String url) {
        try {
            def u = new URL(url);
            def text = u.text
            return new JsonSlurper().parseText(text)
        } catch (Exception ex) {
            System.err.println(url)
            System.err.println(ex.message)
            return null
        }
    }

    def static getHeadStatus(String url) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(30))
                    .method("HEAD", HttpRequest.BodyPublishers.noBody())
                    .build()
            HttpResponse<Void> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.discarding())
            return response.statusCode()
        } catch (Exception ex) {
            System.err.println(url)
            return 0
        }
    }

    static def postJSON(url, Map params) {
        def result = [:]
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url as String))
                    .timeout(Duration.ofSeconds(60))
                    .header(HttpHeaders.CONTENT_TYPE, new MediaType(MediaType.APPLICATION_JSON, StandardCharsets.UTF_8).toString())
                    .POST(HttpRequest.BodyPublishers.ofString(new JsonBuilder(params).toString()))
                    .build()

            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString())
            result.status = response.statusCode()
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                String body = response.body()
                result.content = body ? new JsonSlurper().parseText(body) : null
            } else {
                result.error = "Error POSTing to ${url}"
            }
        } catch (Exception ex) {
            System.err.println(url)
            System.err.println(ex.message)
            result.status = 0
            result.error = "Error POSTing to ${url}"
        }
        result
    }


    /**
     * like or dislike an image
     * this will add a user metadata to an image with keys - like, dislike
     * the value stored in these keys are comma separated user id
     * @param action - LIKE, DISLIKE
     * @param id - image id
     * @param userId - ala id
     * @return
     */
    Map likeOrDislikeImage(String action, String id, String userId){
        if(action && id && userId){
            Map metadata = getImageInfo(id)
            Map likeAndDislikeMetadata = getLikeAndDislikeMetadata(metadata)
            switch (action){
                case 'LIKE':
                    // add user id to like and remove from dislike metadata
                    likeAndDislikeMetadata.like.add(userId)
                    likeAndDislikeMetadata.dislike.remove(userId)
                    break;
                case 'DISLIKE':
                    likeAndDislikeMetadata.like.remove(userId)
                    likeAndDislikeMetadata.dislike.add(userId)
                    break;
            }

            // sync values to image server
            Map upload = [:]
            upload.like = likeAndDislikeMetadata.like.join(',')
            upload.dislike = likeAndDislikeMetadata.dislike.join(',')
            updateUserMetadataOnImage(id, upload)
        }
    }

    /**
     * get image details including metadata information
     * @param id
     * @return
     */
    Map getImageInfo(String id){
        String getImageInfoUrl = "${grailsApplication.config.getProperty('image.baseUrl')}/ws/getImageInfo?id=${id}&includeMetadata=true"
        return getJSON(getImageInfoUrl);
    }

    /**
     * Extract like and dislike metadata
     * @param imageInfo
     * @return
     * [ 'like':'1,24', 'dislike':'23']
     */
    Map getLikeAndDislikeMetadata(Map imageInfo){
        List metadata = imageInfo?.metadata?.findAll{ it ->
            // like and dislike are of type 'UserDefined'
            it.source.name == 'UserDefined' && it.key in ['like','dislike']
        }

        // use HashSet to maintain an unique list of items
        Map result = [ like: new HashSet(), dislike: new HashSet()]
        metadata?.each { it ->
            // prevent adding empty string as it will add an empty string item to set
            if (it.value?.trim()) {
                // user ids are comma separated
                result[it.key].addAll(it.value?.split(','))
            }
        }

        result
    }

    /**
     * update like and dislike metadata for an image
     * id - image id
     * data - user metadata - key value pair
     * [ like: '567']
     * @return
     * {"error":null,"resp":{"success":true}}
     */
    Map updateUserMetadataOnImage(String id, Map data){
        String url = "${grailsApplication.config.getProperty('image.baseUrl')}/ws/bulkAddUserMetadataToImage?id=${id}"
        postJSON(url,data)
    }

    /**
     * finds out if a user has rated an image
     * @param imageId
     * @param userId
     * @return - MAP - Possible values NA , LIKE, DISLIKE
     */
    Map userRating(String imageId, String userId){
        Map result = [success:'NA']
        Map metadata = getImageInfo(imageId)
        Map likeAndDislikeMetadata = getLikeAndDislikeMetadata(metadata)
        if(likeAndDislikeMetadata.like.contains(userId)){
            result.success = 'LIKE'
        } else if(likeAndDislikeMetadata.dislike.contains(userId)){
            result.success = 'DISLIKE'
        }

        return result
    }

}
