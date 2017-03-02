### images-client-plugin   [![Build Status](https://travis-ci.org/AtlasOfLivingAustralia/images-client-plugin.svg?branch=master)](https://travis-ci.org/AtlasOfLivingAustralia/images-client-plugin)
images-client-plugin
====================

This plugin provides a reusable image viewer component based on [Leaflet](http://leafletjs.com/).

## Usage

`runtime ":images-client-plugin:0.6"`

The `image-viewer` resource module needs to be added to the page where we want to use the viewer. Eg using the Resources plugin:

```
<r:require modules="image-viewer"/>
```

:exclamation: This will create a viewer instance in the document global scope called `imgvwr`.

:warning: To display a tiled image we need the `imageId` as per the [images.ala.org.au](http://images.ala.org.au) service and the id of the `<div>` element that will contain the viewer as parameters of the `viewImage` method. Eg:

```
imgvwr.viewImage($("#viewerContainerId"), imageId, {custom options...});
```

### Viewer options
| Option  | Default | Description
| ------- | ------- | -----------
| imageServiceBaseUrl | 'http://images.ala.org.au' | URL where the images service is located
| imageClientUrl | '' | Context path of the app using the plugin e.g. "/specimenbrowser". Required for using calibration and subimaging controls.
| auxDataUrl | N/A  | A URL to a JSON webservice that provides key/value pairs to be rendered in the information popup
| auxDataTitle | N/A  | Default value is 'View more information about this image'. A
| initialZoom | 'auto' | number with the initial zoom level. When set to 'auto' the most suitable zoom level for the viewer container size will be automatically calculated.
| addDownloadButton | true | Shows the image download button control.
| addDrawer | true | Add the rectangle draw tool
| addSubImageToggle | true | Add the "show subimages" button
| addCalibration | true | Add the calibration tools
| addImageInfo | true | Shows button control with link to the image info page.
| addLoading | true | Displays an unobtrusive loading indicator when tiles are loading or when other data is loading.
| addCloseButton | false | Add a control to dismiss bootstrap modal dialog.
| addAttribution | false | Add a control to show image attribution. The text to show is passed on 'attribution' option.
| attribution | '' | Text to show on attribution control. Make sure 'addAttribution' option is switched on.
| addLikeDislikeButton | false | Add button to up and down vote and a help button.
| disableLikeDislikeButton | false | Disable up and down vote buttons when user is not logged in.
| dislikeUrl | '' | Url to call when a user down vote an image.
| likeUrl | '' | Url to call when a user up vote an image.
| userRatingUrl | '' | Url to call to get the current voting on an image.
| userRatingHelpText | '' | Text to display when help button is clicked.
| galleryOptions | {...} | Check the gallery component documentation bellow :point_down:
| showOnlyImage | false | Set this flag to true to view image passed by url. URL is set on parameter imageUrl.
| imageUrl | '' | Set the url of image to display. Leaflet will only show image with tiling switched off. Make sure showOnlyImage flag is set.

### Viewer public methods
| Method | Description
| ------ | -----------
| viewImage(targetDiv, imageId, options) | targetDiv has to be wrapped in a jQuery selector.
| resizeViewer(targetDiv) | required when viewer container is initially hidden or its size changes.
| removeCurrentImage() | Removes current image layer. Use case example: when reuisng viewer instance in a popup you don't want the previous image to show up while the image you have requested is being loaded.
| getViewerInstance() | Provides the leaflet map/image viewer instance in case you need to perform some customizations.
| get/setImageClientBaseUrl(url) | get/set imageClientUrl property
| get/setImageServiceBaseUrl(url) | get/set imageServiceBaseUrl property
| other | There some other public methods that I am not sure they are used. Check source code for more details:  [ala-image-viewer.js](https://github.com/AtlasOfLivingAustralia/images-client-plugin/blob/master/web-app/js/ala-image-viewer.js).


## Thumbnails gallery component

This component converts our viewer component into an fully feature image gallery where you can easily switch between a given set of images that are conveniently presented as thumbnails in an image carousel sitting bellow our already familiar zoomable image viewer. You might be able to picture it better in the following screenshot:

![Imgur](http://i.imgur.com/ge8X0p1.png?1)

The thumbnail carousel is actually a slighltly modified implementation of the [SliderPro](https://github.com/bqworks/slider-pro/) component. These are some of the features it provides around this use case:

* Responsive layout that automatically adjust to available width.
* Thumbnail automatically resized/cropped so all have the same size.
* High level of accessibility due to keyboard support.
* Touch/Swipe friendly for mobile devices.

### Usage

To create the image gallery we need to position the viewer and the thumbnail carousel in out page. The embedded style sheet support the following HTML layout by default:

```html
<div class="img-gallery">
  <div id="imageViewer"></div>
  <div id="carousel" class="slider-pro">
    <div class="sp-slides thumbnails" style="display: none;">
      <g:each in="${occurrence.imageIds}" var="imageId" status="index">
          <div class="sp-slide">
              <img class="sp-image" />
              <img class="sp-thumbnail" src="${occurrence.imageUrls[index]}" img-id="${imageId}"/>
          </div>
      </g:each>
    </div>
  </div>
</div>
```

To instantiate the image thumbnail gallery you just need the id of the corresponding `<div>` container and the custom options if any:

```javascript
new GalleryWidget('carousel', {options}
```

The following snippet example initialises the thumbnail gallery and the viewer:
```javascript
...
var customViewerOptions = {
    imageServiceBaseUrl: imageServiceBaseUrl,
    galleryOptions: {                 // Note #1
        enableGalleryMode: true,
        showFullScreenControls: true
    }
};

new GalleryWidget('carousel', {
    gotoThumbnail: function() {       // Note #2
        imgvwr.removeCurrentImage();
        var selectedImageId = $('#carousel').find('.sp-selected-thumbnail > img').attr('img-id');
        imgvwr.viewImage($("#imageViewer"), selectedImageId, $.extend(customViewerOptions, commonOptions));
    }
});

imgvwr.viewImage($("#imageViewer"), images[0], $.extend(customViewerOptions,commonOptions));
```

**#1** - The viewer requires some options to be set to integrate the viewer gallery related controls with the thumbnail carousel. Please check these options in the corresponding section bellow :point_down:

**#2** - The GalleryWidget options are those available in the SliderPro component, but many of them do not apply to the thumbnail gallery: [SliderPro options](https://github.com/bqworks/slider-pro/blob/master/docs/api.md#1-properties). :exclamation:The `gotoThumbnail` property needs to be provided always to see the selected image in the viewer.

### Image viewer gallery related options
| Option  | Default | Description
| ------- | ------- | -----------
| enableGalleryMode | false | Need to be set to true if we want the viewer to take into consideration the other options available.
| closeControlContent | null | In the case that the viewer is opened in a modal dialog or something similar, you need a button with the markup required to close the dialog. :warning:The close control button is hidden in full screen mode. See example #1
| showFullScreenControls | false | if true the viewer will show a control bar with two buttons to show the previous and next images. :warning: These controls are only displayed in full-screen mode.

**Example #1**:
```javascript
galleryOptions: {
    enableGalleryMode: true,
    closeControlContent: '<i class="fa fa-times" data-dismiss="modal" aria-label="Close" style="line-height:1.65;"></i>',
    showFullScreenControls: true
}
```
In this example the `closeControlContent` property adds a font-awesome icon to the control and adds the necessary markup to close a Bootstrap 3 modal dialog when it is clicked:

### Image thumbnail gallery carousel default settings
Check the [SliderPro documentation](https://github.com/bqworks/slider-pro/blob/master/docs/api.md#1-properties) for more information.

```javascript
var defaultOptions = {
    width: '100%',
    height: '100%',
    fade: true,
    arrows: false,
    buttons: false,
    fullScreen: false,
    shuffle: false,
    thumbnailArrows: true,
    autoplay: false
};
```

All those can be overridden when creating the `GalleryWidget` instance.

### Bootstrap 3 modal dialog use case
TODO


## Changelog

* **version 0.7** (14/06/2016)
  * Added feature to up and down vote an image.

* **version 0.6.1** (15/06/2015)
  * Bugfix for img thumbnail carousel.

* **version 0.6** (10/06/2015)
  * Added reusable thumbnail image gallery component based a customized implementation of the [SliderPro](https://github.com/bqworks/slider-pro/) component to reuse just the thumbnail gallery bit. This component is responsive, accesible through keyboard and support the swipe mobile events.
  * Added some image gallery related options for the existing leaflet based viewer.

* **version 0.5.3** (02/06/2015)
  * Bugfix release

* **version 0.5** (28/05/2015)
  * Transfer of the subimaging tools to this plugin
  * Added [leaflet.loading](https://github.com/ebrelsford/Leaflet.loading) control.

* **version 0.4** (20/05/2015)
  * Optional parameter `initialZoom` default value is now 'auto'. This means that the component will adjust the optimum zoom level so the image fits inside the image viewer container.
  * Removed unnecessary grails plugin dependency with ala-bootstrap2.
