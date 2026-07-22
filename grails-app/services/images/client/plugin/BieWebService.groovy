package images.client.plugin

import grails.converters.JSON
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType

import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.net.http.HttpTimeoutException
import java.nio.charset.StandardCharsets
import java.time.Duration

/**
 * Created by koh032 on 2/03/2017.
 */
class BieWebService {

    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build()

    def grailsApplication

    private String getServiceUrl() {
        def url = grailsApplication.config.getProperty('bieService.baseURL') ?: grailsApplication.config.getProperty('bieService.baseUrl') ?: null
        if (url && !url.endsWith("/")) {
            url += "/"
        } else if (!url) {
            url = ""
        }
        return url
    }

    def updateBieIndex(def guidImageList) {

        List<Map> list = []
        guidImageList.each{
            def imageKvp = it.kvps?.find { kvp ->
                kvp.key == 'imageId'
            }
            String imageId = imageKvp?.value ? imageKvp.value : ''
            list.push ([guid: it.guid, image: imageId])
        }
        String url = getServiceUrl() + "updateImages"
        String jsonBody = (list as JSON).toString()
        def response = [:]
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(60))
                    .header(HttpHeaders.CONTENT_TYPE, new MediaType(MediaType.APPLICATION_JSON, StandardCharsets.UTF_8).toString())
                    .header("Authorization", grailsApplication.config.getProperty('bieService.apiKey') ?: "")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .build()

            HttpResponse<String> httpResponse = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString())
            int status = httpResponse.statusCode()
            String responseStr = httpResponse.body()

            if (!responseStr && status != 200) {
                response = [text: "Error occurred while calling Bie update Images" + responseStr, status: status ]
            } else {
                response = [text: "Bie updated successfully", status: status ]
            }
            log.info "${response.text} status: ${response.status}"

        } catch (HttpTimeoutException e) {
            String error = "Timed out calling web service. ${e.getMessage()} URL= ${url}. "
            log.error error
            response = [text: error, status: 500 ]
        } catch (Exception e) {
            String error = "Failed calling web service. ${e.getMessage()}. You may also want to check bieService.baseURL config.  URL= ${url}."
            log.error error
            response = [text: error, status: 500]
        }
        return response


    }

}
