package images.client.plugin

import grails.converters.JSON
import groovy.json.JsonSlurper
import org.apache.commons.httpclient.HttpClient
import org.apache.commons.httpclient.HttpStatus
import org.apache.commons.httpclient.methods.GetMethod
import org.apache.commons.httpclient.methods.PostMethod
import org.apache.commons.httpclient.methods.StringRequestEntity
import org.springframework.cache.annotation.CacheEvict
import org.springframework.cache.annotation.Cacheable
import org.springframework.web.context.request.RequestContextHolder

class SpeciesListWebService {

    def grailsApplication
    def authService

    private String getServiceUrl() {
        def url = grailsApplication.config.speciesList?.baseURL?:grailsApplication.config.speciesList?.baseUrl?:null
        if (url && !url.endsWith("/")) {
            url += "/"
        } else if (!url) {
            url = ""
        }
        return url
    }

    private getSpeciesListDruid() {
        return grailsApplication.config.speciesList.preferredSpeciesListDruid ? grailsApplication.config.speciesList.preferredSpeciesListDruid : "dr4778"
    }

    private getSpeciesListName() {
        return grailsApplication.config.speciesList.preferredListName ? grailsApplication.config.speciesList.preferredListName : "ALA Preferred Species Images"
    }

    @Cacheable("speciesListKvp")
    def getPreferredImageSpeciesList() {
        String druid = getSpeciesListDruid()
        String url = getServiceUrl() + "ws/speciesListItemKvp/" + druid
        log.info("Calling species list web service: " + getServiceUrl() + "ws/speciesListItemKvp/" + druid)
        List results = []
        def result = get(url,  grailsApplication.config.speciesList.apiKey)
        if (result.status != HttpStatus.SC_OK) {
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
        def response = post(url, body, grailsApplication.config.speciesList.apiKey)
        return [status: response.status, text: response.text, data: response.data?.data]
    }

    private post(String url, Object body, String apiKey) {
        def response = [:]
        try {
            HttpClient client = new HttpClient();
            PostMethod post = new PostMethod(url);
            post.setRequestHeader('Authorization', apiKey)
            if (RequestContextHolder.getRequestAttributes() != null) {
                def user = authService.userDetails()

                if (user) {
                    post.setRequestHeader("X-ALA-userId", user.userId as String)
                    post.setRequestHeader("Cookie", "ALA-Auth=${URLEncoder.encode(user.email, "UTF-8")}")
                }
            }
            String jsonBody = (body as JSON).toString()
            StringRequestEntity requestEntity = new StringRequestEntity(jsonBody, "application/json", "utf-8")
            post.setRequestEntity(requestEntity)
            int status = client.executeMethod(post);
            String responseStr = post.getResponseBodyAsString();
            def data = null

            if (status >= HttpStatus.SC_OK && status <= HttpStatus.SC_ACCEPTED) {
                data = new JsonSlurper().parseText(responseStr)
            }
            response = [status: status, text: responseStr, data: data]
            log.debug "${response.text} status: ${response.status}"
        } catch (SocketTimeoutException e) {
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
            HttpClient client = new HttpClient();
            GetMethod get = new GetMethod(url);
            get.setRequestHeader('Authorization', apiKey)
            if (RequestContextHolder.getRequestAttributes() != null) {
                def user = authService.userDetails()

                if (user) {
                    get.setRequestHeader("X-ALA-userId", user.userId as String)
                    get.setRequestHeader("Cookie", "ALA-Auth=${URLEncoder.encode(user.email, "UTF-8")}")
                }
            }
            int status = client.executeMethod(get);
            String responseStr = get.getResponseBodyAsString();
            def data = null

            if (status == HttpStatus.SC_OK) {
                data = new JsonSlurper().parseText(responseStr)
            }
            response = [status: status, text: responseStr, data: data]
            log.debug "${response.text} status: ${response.status}"
        } catch (SocketTimeoutException e) {
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
}
