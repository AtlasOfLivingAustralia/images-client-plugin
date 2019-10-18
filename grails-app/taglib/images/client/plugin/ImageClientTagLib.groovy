package images.client.plugin

import grails.config.Config
import grails.core.support.GrailsConfigurationAware

/**
 * Image Client Tag Lib to be used in the gsp related to image client plugin feature
 *
 */
class ImageClientTagLib implements GrailsConfigurationAware {
    static namespace = 'imageClient'

    List<String> allowedRoles = []

    @Override
    void setConfiguration(Config config) {
        def roleList = config.getProperty("allowedImageEditingRoles", "")
        allowedRoles = roleList ? roleList.split(",").collect({ it.trim() }) : []
    }
/**
     *
     *  Outputs true if user is logged in and user role is in the allowable configured roles: allowedImageEditingRoles (Note that the IP must also match the authorised system IP for the user).
     *  Otherwise, outputs false.
     *
     */
    def checkAllowableEditRole = { attrs ->
        boolean match = allowedRoles.any { request.isUserInRole(it) }
        out << match;
    }

}
