package images.client.plugin

import grails.converters.JSON
import org.apache.commons.httpclient.HttpClient
import org.apache.commons.httpclient.methods.PostMethod
import org.apache.commons.httpclient.methods.StringRequestEntity

/**
 * Created by koh032 on 2/03/2017.
 */
class BieWebService {
    def grailsApplication

    private String getServiceUrl() {
        def url = grailsApplication.config.bieService?.baseURL?:grailsApplication.config.bieService?.baseUrl?:null
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
            HttpClient client = new HttpClient();
            PostMethod post = new PostMethod(url);
            post.setRequestHeader('Authorization', grailsApplication.config.bieService.apiKey)
            StringRequestEntity requestEntity = new StringRequestEntity(jsonBody, "application/json", "utf-8")
            post.setRequestEntity(requestEntity)
            int status = client.executeMethod(post);
            String responseStr = post.getResponseBodyAsString();

            if (!responseStr && status != 200) {
                response = [text: "Error occurred while calling Bie update Images" + responseStr, status: status ]
            } else {
                response = [text: "Bie updated successfully", status: status ]
            }
            log.info "${response.text} status: ${response.status}"

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

}
