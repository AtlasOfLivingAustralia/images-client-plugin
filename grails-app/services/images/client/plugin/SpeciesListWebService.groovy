package images.client.plugin

import grails.converters.JSON
import groovy.json.JsonSlurper
import org.springframework.cache.annotation.CacheEvict
import org.springframework.cache.annotation.Cacheable
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.web.context.request.RequestContextHolder

import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.net.http.HttpTimeoutException
import java.nio.charset.StandardCharsets
import java.time.Duration

class SpeciesListWebService {

    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build()

    def grailsApplication
    def authService

    private String getServiceUrl() {
        def url = grailsApplication.config.getProperty('speciesList.baseURL') ?: grailsApplication.config.getProperty('speciesList.baseUrl') ?: null
        if (url && !url.endsWith("/")) {
            url += "/"
        } else if (!url) {
            url = ""
        }
        return url
    }

    private getSpeciesListDruid() {
        return grailsApplication.config.getProperty('speciesList.preferredSpeciesListDruid', String, "dr4778")
    }

    private getSpeciesListName() {
        return grailsApplication.config.getProperty('speciesList.preferredListName', String, "ALA Preferred Species Images")
    }

    @Cacheable("speciesListKvp")
    def getPreferredImageSpeciesList() {
        String druid = getSpeciesListDruid()
        String url = getServiceUrl() + "ws/speciesListItemKvp/" + druid
        log.info("Calling species list web service: " + getServiceUrl() + "ws/speciesListItemKvp/" + druid)
        List results = []
        def result = get(url,  grailsApplication.config.getProperty('speciesList.apiKey'))
        if (result.status != HttpStatus.OK.value()) {
            throw new IOException(result.text)
        }
        result.data.each {
            String imageId = ""
            it.kvps?.each { kvp ->
                if (kvp.key == "imageId") {
                    imageId = kvp.value ?: ""
                }
            }
            if (imageId.trim() != "") {
                results.push(["name": it.name, "imageId": imageId])
            }
        }
        return results
    }

    @CacheEvict(value="speciesListKvp", allEntries=true)
    def saveImageToSpeciesList(def scientificName, def family, def imageId) {
        String druid = getSpeciesListDruid ()
        String listNameVal = getSpeciesListName ()
        String url = getServiceUrl() + "ws/speciesList/" + druid
        List kvpValues = [[key: 'imageId', value: imageId]]
        if (family)
            kvpValues << [key: 'family', value: family]
        Map listMap = [
                itemName: scientificName, kvpValues: kvpValues
        ]
        Map body = [listName: listNameVal, listItems: [listMap], replaceList: false]
        def response = post(url, body, grailsApplication.config.getProperty('speciesList.apiKey'))
        return [status: response.status, text: response.text, data: response.data?.data]
    }

    private post(String url, Object body, String apiKey) {
        def response = [:]
        try {
            String jsonBody = (body as JSON).toString()
            HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(60))
                    .header(HttpHeaders.CONTENT_TYPE, new MediaType(MediaType.APPLICATION_JSON, StandardCharsets.UTF_8).toString())
                    .header("Authorization", apiKey ?: "")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
            applyUserHeaders(requestBuilder)

            HttpResponse<String> httpResponse = HTTP_CLIENT.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString())
            int status = httpResponse.statusCode()
            String responseStr = httpResponse.body()
            def data = null

            if (status >= HttpStatus.OK.value() && status <= HttpStatus.ACCEPTED.value()) {
                data = new JsonSlurper().parseText(responseStr)
            }
            response = [status: status, text: responseStr, data: data]
            log.debug "${response.text} status: ${response.status}"
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

    private get(String url, String apiKey) {
        def response = [:]
        try {
            HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(60))
                    .header("Authorization", apiKey ?: "")
                    .GET()
            applyUserHeaders(requestBuilder)

            HttpResponse<String> httpResponse = HTTP_CLIENT.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString())
            int status = httpResponse.statusCode()
            String responseStr = httpResponse.body()
            def data = null

            if (status == HttpStatus.OK.value()) {
                data = new JsonSlurper().parseText(responseStr)
            }
            response = [status: status, text: responseStr, data: data]
            log.debug "${response.text} status: ${response.status}"
        } catch (HttpTimeoutException e) {
            String error = "Timed out calling web service. ${e.getMessage()} URL= ${url}. "
            log.error error
            response = [text: error, status: 500 ]
        } catch (Exception e) {
            String error = "Failed calling web service. ${e.getMessage()}. You may also want to check speciesList.baseURL config.  URL= ${url}."
            log.error error
            response = [text: error, status: 500]
        }
        return response
    }

    private void applyUserHeaders(HttpRequest.Builder requestBuilder) {
        if (RequestContextHolder.getRequestAttributes() != null) {
            def user = authService.userDetails()

            if (user) {
                requestBuilder.header("X-ALA-userId", user.userId as String)
                requestBuilder.header("Cookie", "ALA-Auth=${URLEncoder.encode(user.email, "UTF-8")}")
            }
        }
    }
}
