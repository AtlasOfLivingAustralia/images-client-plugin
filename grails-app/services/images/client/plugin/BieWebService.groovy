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
        def url = grailsApplication.config.bieService.baseUrl
        if (!url.endsWith("/")) {
            url += "/"
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
           // post.setRequestHeader('Cookie', cookie.toString())
            post.setRequestHeader('Authorization', grailsApplication.config.bieApiKey)
            StringRequestEntity requestEntity = new StringRequestEntity(jsonBody, "application/json", "utf-8")
            post.setRequestEntity(requestEntity)
            int status = client.executeMethod(post);
            String responseStr = post.getResponseBodyAsString();

            if (!responseStr && status != 200) {
                response = [text: "Error occurred while calling Bie update Images" + responseStr, status: status ]
            } else {
                response = [text: "Bie updated successfully", status: status ]
            }
            log.info (text: response, status: status)

        } catch (SocketTimeoutException e) {
            def error = [text: "Timed out calling web service. URL= ${url}."]
            log.error(error, e)
            response = [text: error, status: 500 ]
        } catch (Exception e) {
            def error = [text: "Failed calling web service. ${e.getMessage()} URL= ${url}."]
            log.error(error, e)
            response = [text: error, status: 500]
        }
        return response


    }

}
