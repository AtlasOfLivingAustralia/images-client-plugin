
// array.find() is not supported in IE so polyfill an implementation here
// https://tc39.github.io/ecma262/#sec-array.prototype.find
if (!Array.prototype.find) {
    Object.defineProperty(Array.prototype, 'find', {
        value: function(predicate) {
            // 1. Let O be ? ToObject(this value).
            if (this == null) {
                throw new TypeError('"this" is null or not defined');
            }

            var o = Object(this);

            // 2. Let len be ? ToLength(? Get(O, "length")).
            var len = o.length >>> 0;

            // 3. If IsCallable(predicate) is false, throw a TypeError exception.
            if (typeof predicate !== 'function') {
                throw new TypeError('predicate must be a function');
            }

            // 4. If thisArg was supplied, let T be thisArg; else let T be undefined.
            var thisArg = arguments[1];

            // 5. Let k be 0.
            var k = 0;

            // 6. Repeat, while k < len
            while (k < len) {
                // a. Let Pk be ! ToString(k).
                // b. Let kValue be ? Get(O, Pk).
                // c. Let testResult be ToBoolean(? Call(predicate, T, « kValue, k, O »)).
                // d. If testResult is true, return kValue.
                var kValue = o[k];
                if (predicate.call(thisArg, kValue, k, o)) {
                    return kValue;
                }
                // e. Increase k by 1.
                k++;
            }

            // 7. Return undefined.
            return undefined;
        }
    });
}

var imgvwr = {};

(function(lib) {

    var _viewer;
    var _imageOverlays;
    var _imageId;
    var _scientificName;
    var _preferredImageStatus;
    var _imageScaleFactor;
    var _imageHeight;

    var map_registry = {};
    var imageServiceBaseUrl = "https://images.ala.org.au";
    //this should be the context path of the app using the plugin e.g. "/specimenbrowser"
    var imageClientUrl = "";

    var base_options = {
        auxDataUrl: '',
        auxDataTitle: 'View more information about this image',
        attribution:null,
        initialZoom: 'auto',
        zoomFudgeFactor: 1,
        disableLikeDislikeButton: false,
        addDownloadButton: true,
        addDrawer: true,
        addSubImageToggle: true,
        addCalibration: true,
        addCloseButton: false,
        addImageInfo: true,
        addLoading: true,
        addAttribution: false,
        addPreferenceButton: false,
        addLikeDislikeButton: false,
        dislikeUrl: '',
        likeUrl: '',
        userRatingUrl: '',
        userRatingHelpText: '<div><b>Up vote (<i class="fa fa-thumbs-o-up" aria-hidden="true"></i>) an image:</b>'+
        ' Image supports the identification of the species or is representative of the species.  Subject is clearly visible including identifying features.<br/><br/>'+
        '<b>Down vote (<i class="fa fa-thumbs-o-down" aria-hidden="true"></i>) an image:</b>'+
        ' Image does not support the identification of the species, subject is unclear and identifying features are difficult to see or not visible.<br/></div>',
        savePreferredSpeciesListUrl: '',
        getPreferredSpeciesListUrl: '',
        druid: '',
        galleryOptions: {
            enableGalleryMode: false,
            closeControlContent: null,
            showFullScreenControls: false
        }
    };

    lib.getImageClientBaseUrl = function(){
        return imageClientUrl;
    };

    lib.getImageServiceBaseUrl = function(){
        return imageServiceBaseUrl;
    };

    lib.setImageClientBaseUrl = function(url){
        imageClientUrl = url;
    };

    lib.setImageServiceBaseUrl = function(url){
        imageServiceBaseUrl = url;
    };

    lib.setPixelLength = function(pixelLength){
        _viewer.measureControl.mmPerPixel = pixelLength;
    };

    lib.viewImage = function(targetDiv, imageId, scientificName, guid, options) {
        _imageId = imageId;
        _scientificName = scientificName;
        _preferredImageStatus = false;
        if(options.imageServiceBaseUrl){
            lib.setImageServiceBaseUrl(options.imageServiceBaseUrl);
        }
        if(options.imageClientBaseUrl){
            lib.setImageClientBaseUrl(options.imageClientBaseUrl);
        }

        if (options.addPreferenceButton) {
            var checkSpeciesList = null;

            if (guid != undefined) {
                checkSpeciesList = checkSpeciesImage(guid, imageId, options.druid, options.getPreferredSpeciesListUrl)
            } else if (scientificName != undefined) {
                checkSpeciesList = checkSpeciesByNameImage(scientificName, imageId, options.getPreferredSpeciesListUrl)
            }

            // if checkSpeciesList is null, the promise is resolved immediately and resp is null: https://api.jquery.com/jquery.when/
            $.when(checkSpeciesList).then(function (resp) {
                if (resp != undefined) {
                    _preferredImageStatus = resp;
                }
                var mergedOptions = mergeOptions(options, targetDiv, imageId);
                initViewer(mergedOptions);
            }, function(error) {
                options.addPreferenceButton = false;
                var mergedOptions = mergeOptions(options, targetDiv, imageId);
                initViewer(mergedOptions);
            });
        } else {
            var mergedOptions = mergeOptions(options, targetDiv, imageId);
            initViewer(mergedOptions);
        }
    };

    lib.resizeViewer = function(targetDiv) {
        var target = getTarget(targetDiv);
        map_registry[target].invalidateSize();
    };

    /**
     * Removes current image layer. Use case example: when reuisng viewer instance in a popup you don't want the previous
     * image to show up while the image you have requested is being loaded
     */
    lib.removeCurrentImage = function() {
        if (_viewer) {
            _viewer.eachLayer(function (layer) {
                _viewer.removeLayer(layer);
            });
        }
    };

    /**
     * Provides the leaflet map/image viewer instance in case you need to perform some customizations
     * @returns leaflet map instance instance
     */
    lib.getViewerInstance = function() {
        return _viewer;
    };

    /** Allows the target div to be specified as a selector or jquery object */
    function getTarget(target) {
        return $(target).get(0);
    }

    function mergeOptions(userOptions, targetDiv, imageId) {
        var mergedOptions = {
            target:  targetDiv,
            imageId: imageId
        };

        $.extend(mergedOptions, base_options, userOptions);

        return mergedOptions;
    }

    function checkSpeciesImage(guid, imageId, druid, getPreferredSpeciesListUrl) {
        var promise = $.Deferred();
        var url = getPreferredSpeciesListUrl + "/ws/species?guid=" + guid + "&dr=" + druid;
        $.ajax( {
            dataType: 'json',
            url: url, //+ "?dr=drt1476827971152",
            type: 'get',
            timeout:8000,
            success: function (data) {
                if (data) {
                    var result = data.find (function(obj) {
                        return (
                            obj.kvpValues.find(function (kvpValues) {
                                return kvpValues.key =='imageId' && kvpValues.value == imageId
                            }))
                    });
                    promise.resolve(result != undefined)
                } else {
                    promise.resolve(false)
                }
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.error ("Error when calling " + url + " (" + errorThrown + ")");
                promise.reject(jqXHR, textStatus, errorThrown);
                return promise;
            }
        })
        return promise;

    }

    function checkSpeciesByNameImage(scientificName, imageId, getPreferredSpeciesListUrl) {
        var promise = $.Deferred();
        $.ajax( {
            dataType: 'json',
            url: getPreferredSpeciesListUrl,
            type: 'get',
            timeout:8000,
            success: function (data) {
                if (data) {
                    var result = data.find(function (obj) {
                        return (obj.name === scientificName && obj.imageId === imageId);
                    });
                    promise.resolve(result != undefined)
                } else {
                    promise.resolve(false)
                }
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.error ("Error when calling " + getPreferredSpeciesListUrl + "(" + errorThrown + ")");
                promise.reject(jqXHR, textStatus, errorThrown);
                return promise;
            }});
        return promise;
    }

    function initViewer(opts) {
        $.ajax( {
            dataType: 'jsonp',
            url: imageServiceBaseUrl + "/ws/image/" + _imageId,
            crossDomain: true
        }).done(function(image) {
            if (image.success) {
                _createViewer(opts, image);
            } else {
                alert('Unable to load image from ' + imageServiceBaseUrl + "/ws/image/" + _imageId)
            }
        }).fail(function(){
            alert('Unable to load image from ' + imageServiceBaseUrl + "/ws/image/" + _imageId)
        });
    }

    function _createViewer(opts, image) {

        _imageId = opts.imageId;
        var maxZoom = image.tileZoomLevels ? image.tileZoomLevels - 1 : 0;

        _imageScaleFactor =  Math.pow(2, maxZoom);
        _imageHeight = image.height;

        var centerx = image.width / 2 / _imageScaleFactor;
        var centery = image.height / 2 / _imageScaleFactor;

        var p1 = L.latLng(image.height / _imageScaleFactor, 0);
        var p2 = L.latLng(0, image.width / _imageScaleFactor);
        var bounds = new L.latLngBounds(p1, p2);

        var measureControlOpts = false;

        var drawnItems = new L.FeatureGroup();

        _imageOverlays = new L.FeatureGroup();

        if (opts.addCalibration) {
            measureControlOpts = {
                mmPerPixel: image.mmPerPixel,
                imageScaleFactor: _imageScaleFactor,
                imageWidth: image.width,
                imageHeight: image.height,
                hideCalibration: !opts.addCalibration,
                onCalibration: function (pixels) {
                    var opts = {
                        url: imageClientUrl + "/imageClient/calibrateImage?id=" + _imageId + "&pixelLength=" + Math.round(pixels) + '&callback=calibrationCallback',
                        title: 'Calibrate image scale'
                    };
                    lib.showModal(opts);
                }
            };
        }

        var target = getTarget(opts.target);

        // Check if this element has already been initialized as a leaflet viewer
        if (map_registry[target]) {
            // if so, we need to un-initialize it
            map_registry[target].remove();
            delete map_registry[target];
        }

        var viewer = L.map(target, {
            fullscreenControl: true,
            measureControl: measureControlOpts,
            minZoom: 2,
            maxZoom: maxZoom,
            zoom: getInitialZoomLevel(opts.initialZoom, opts.zoomFudgeFactor, maxZoom, image, opts.target),
            center: new L.LatLng(centery, centerx),
            crs: L.CRS.Simple
        });

        _viewer = viewer;

        viewer.addLayer(drawnItems);

        map_registry[target] = viewer;

        var urlMask = image.tileUrlPattern;
        L.tileLayer(urlMask, {
            maxNativeZoom: maxZoom,
            continuousWorld: true,
            tms: true,
            noWrap: true,
            bounds: bounds,
            attribution: (opts.organisationName? opts.organisationName : 'Atlas of Living Australia')
        }).addTo(viewer);

        if (opts.addImageInfo){
            var ImageInfoControl = L.Control.extend( {

                options: {
                    position: "bottomleft",
                    title: 'Image details'
                },
                onAdd: function (map) {
                    var container = L.DomUtil.create("div", "leaflet-bar");
                    var detailsUrl = imageServiceBaseUrl + "/image/" + _imageId;
                    $(container).html("<a href='" + detailsUrl + "' title='" + this.options.title + "'><span class='fa fa-external-link'></span></a>");
                    return container;
                }
            });
            viewer.addControl(new ImageInfoControl());
        }

        if (opts.auxDataUrl) {

            var AuxInfoControl = L.Control.extend({

                options: {
                    position: "topleft",
                    title: 'Auxiliary data'
                },
                onAdd: function (map) {
                    var container = L.DomUtil.create("div", "leaflet-bar");
                    $(container).html("<a id='btnImageAuxInfo'  title='" + opts.auxDataTitle + "' href='#'><span class='fa fa-info'></span></a>");
                    $(container).find("#btnImageAuxInfo").click(function (e) {
                        e.preventDefault();
                        $.ajax( {
                            dataType: 'jsonp',
                            url: opts.auxDataUrl,
                            crossDomain: true
                        }).done(function(auxdata) {
                            var body = "";
                            if (auxdata.data) {
                                body = '<table class="table table-condensed table-striped table-bordered">';
                                for (var key in auxdata.data) {
                                    body += '<tr><td>' + key + '</td><td>' + auxdata.data[key] + '</td></tr>';
                                }
                                body += '</table>';
                            }

                            if (auxdata.link && auxdata.linkText) {
                                body += '<div><a class="btn btn-primary" href="' + auxdata.link + '">' + auxdata.linkText + '</a>';
                            } else if (auxdata.link) {
                                body += '<div><a class="btn btn-primary" href="' + auxdata.link + '">' + auxdata.link + '</a>';
                            }

                            lib.showModal({
                                title: auxdata.title ? auxdata.title : "Image " + _imageId,
                                content: body,
                                width: 800
                            });
                        });
                    });
                    return container;
                }
            });

            viewer.addControl(new AuxInfoControl());
        }

        if (opts.addDownloadButton) {

            var DownloadControl = L.Control.extend({

                options: {
                    position: "topleft",
                    title: 'Download button'
                },
                onAdd: function (map) {
                    var container = L.DomUtil.create("div", "leaflet-bar");
                    $(container).html("<a id='btnDownload' title='Download this image' href='#'><span class='fa fa-download'></span></a>");
                    $(container).find("#btnDownload").click(function (e) {
                        e.preventDefault();
                        window.location.href = imageServiceBaseUrl + "/image/proxyImage/" + _imageId + "?contentDisposition=true";
                    });
                    return container;
                }
            });

            viewer.addControl(new DownloadControl());
        }

        if (opts.addDrawer){
            // Initialise the draw control and pass it the FeatureGroup of editable layers
            var drawControl = new L.Control.Draw({
                edit: {
                    featureGroup: drawnItems
                },
                draw: {
                    position: 'topleft',
                    circle: false,
                    rectangle: {
                        shapeOptions: {
                            weight: 1,
                            color: 'blue'
                        }
                    },
                    marker: false,
                    polyline: false,
                    polygon: false
                }

            });
            viewer.addControl(drawControl);

            $(".leaflet-draw-toolbar").last().append('<a id="btnCreateSubimage" class="viewer-custom-buttons leaflet-disabled fa fa-picture-o" href="#" title="Draw a rectangle to create a sub image"></a>');

            $("#btnCreateSubimage").click(function(e) {
                e.preventDefault();

                var layers = drawnItems.getLayers();
                if (layers.length <= 0) {
                    return;
                }

                var ll = layers[0].getLatLngs();

                // Need to calculate x,y,height and width, where x is the min longitude,
                // y = min latitude, height = max latitude - y and width = max longitude - x
                var minx = image.width, miny = image.height, maxx = 0, maxy = 0;

                for (var i = 0; i < ll.length; ++i) {
                    var y = Math.round(image.height - ll[i].lat * _imageScaleFactor);
                    var x = Math.round(ll[i].lng * _imageScaleFactor);

                    if (y < miny) {
                        miny = y;
                    }
                    if (y > maxy) {
                        maxy = y;
                    }
                    if (x < minx) {
                        minx = x;
                    }
                    if (x > maxx) {
                        maxx = x;
                    }
                }

                var height = maxy - miny;
                var width = maxx - minx;

                var url = imageClientUrl + "/imageClient/createSubImage?id=" + _imageId + "&x=" + minx + "&y=" + miny + "&width=" + width + "&height=" + height + "&callback=createSubImageCallback";
                var opts = {
                    title: "Create subimage",
                    url: url,
                    onClose: function() {
                        drawnItems.clearLayers();
                    }
                };
                lib.showModal(opts);
            });

            viewer.on('draw:created', function (e) {
                //var type = e.layerType,
                var layer = e.layer;
                drawnItems.clearLayers();
                drawnItems.addLayer(layer);
                $("#btnCreateSubimage").removeClass("leaflet-disabled");
                $("#btnCreateSubimage").attr("title", "Create a subimage from the currently drawn rectangle");
            });

            viewer.on('draw:deleted', function (e) {
                var button = $("#btnCreateSubimage");
                button.addClass("leaflet-disabled");
                button.attr("title", "Draw a rectangle to create a subimage");

            });
        }

        if (opts.addSubImageToggle){

           viewer.addLayer(_imageOverlays);

            var ViewSubImagesControl = L.Control.extend({

                options: {
                    position: "topright",
                    title: 'View subimages button'
                },
                onAdd: function (map) {
                    var container = L.DomUtil.create("div", "leaflet-bar");
                    $(container).html("<a id='btnViewSubimages' data-switch='off' title='View subimages' href='#' style='width:110px;'>Show&nbsp;subimages</a>");
                    $(container).find("#btnViewSubimages").click(function (e) {
                        e.preventDefault();
                        lib.toggleSubimages();
                    });
                    return container;
                }
            });
            viewer.addControl(new ViewSubImagesControl());
        }

        if (opts.addPreferenceButton) {

            var PreferenceControl = L.Control.extend({

                options: {
                    position: "topleft",
                    title: 'Add image to ALA Preferred Species Images List',
                    preferredImageStatus: _preferredImageStatus,
                    savePreferredSpeciesListUrl: opts.savePreferredSpeciesListUrl
                },
                onAdd: function (map) {
                    var self = this;
                    var container = L.DomUtil.create("div", "leaflet-bar");
                    $(container).html("<a id='btnPreferredImage' title='Add image to Preferred Species Images List' href='#'><span class='fa fa-star'></span></a>");
                    $(container).find("#btnPreferredImage").click(function (e) {
                        e.preventDefault();
                        if (self.options.preferredImageStatus) {
                            showAlert("You cannot add this images as it has already been added to ALA Preferred Species Image List");
                        } else {
                            $.ajax({
                                url: self.options.savePreferredSpeciesListUrl,
                                success: function (data) {
                                    if (data.status == 200) {
                                        setPreferredButton(container);
                                        self.options.preferredImageStatus == true;
                                        showAlert("This Image has been successfully added to ALA Preferred Species Image List");
                                    } else {
                                        showAlert("An error has occurred: Status " + data.status + " Reason: " + data.text);
                                    }
                                },
                                error: function (data) {
                                    showAlert("An error occurred while saving metadata to image. Status: " + data.status + " Reason: " + data.responseText);
                                }
                            })
                        }
                    });

                    if (self.options.preferredImageStatus) {
                        setPreferredButton(container);
                    }

                    return container;
                }
            });

            viewer.addControl(new PreferenceControl());

        }

        if (opts.addLikeDislikeButton){
            var helpControl;
            // block of code for like, dislike and help buttons
            var FeedbackControl = L.Control.extend({
                options: {
                    position: "topleft",
                    title: 'Close this dialog',
                    disableButtons: opts.disableLikeDislikeButton,
                    likeUrl: opts.likeUrl,
                    dislikeUrl: opts.dislikeUrl,
                    userRatingUrl: opts.userRatingUrl
                },
                onAdd: function (map) {
                    var self = this;
                    var container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
                    
                    $(container).html('<a id="leafletLikeButton" href="#" class="fa fa-thumbs-o-up fa-2" aria-hidden="true"></i>' +
                        '<a id="leafletDislikeButton" href="#" class="fa fa-thumbs-o-down fa-2" aria-hidden="true"></a>' +
                        '<a id="leafletLikeDislikeHelpButton" href="#" class="fa fa-question fa-2" aria-hidden="true" title="Show help text"></a>'
                    );

                    // like an image
                    $(container).find('#leafletLikeButton').on('click', function (event) {
                        event.preventDefault();
                        if(self.options.disableButtons){
                            return;
                        }

                        loadingControl.addLoader('like')

                        $.ajax({
                            url:self.options.likeUrl,
                            success: function (data) {
                                if(data.content.success){
                                    setLikeButton()
                                    loadingControl.removeLoader('like')
                                }
                            },
                            error:function () {
                                loadingControl.removeLoader('like')
                            }
                        })
                    });

                    // dislike an image
                    $(container).find('#leafletDislikeButton').on('click', function (event) {
                        event.preventDefault();
                        if(self.options.disableButtons){
                            return;
                        }

                        loadingControl.addLoader('dislike')
                        $.ajax({
                            url:self.options.dislikeUrl,
                            success: function (data) {
                                if(data.content.success){
                                    setDislikeButton()
                                    loadingControl.removeLoader('dislike')
                                }
                            },
                            error: function () {
                                loadingControl.removeLoader('dislike')
                            }
                        })
                    });

                    // help button
                    $(container).find('#leafletLikeDislikeHelpButton').on('click', function (event) {
                        // remove previous control created
                        if(helpControl){
                            viewer.removeControl(helpControl);
                            helpControl = null;
                        }

                        // create new control
                        var HelpControl = L.Control.extend({

                            options: {
                                position: "topleft",
                                userRatingHelpText: opts.userRatingHelpText
                            },
                            onAdd: function (map) {
                                var container = L.DomUtil.create("div", "leaflet-control-layers");
                                this.container = container;
                                var helpText =  this.options.userRatingHelpText || base_options.userRatingHelpText;
                                $(container).html('<div style="padding:10px; width: 200px;"><a href="#" class="user-rating-help-text-dialog pull-right" style="padding-left:10px;"><b style="color:black"><i class="fa fa-times"></i></b></a>' + helpText + "</div>");
                                $(container).find('.user-rating-help-text-dialog').on('click', function (event) {
                                    viewer.removeControl(helpControl);
                                    helpControl = null;
                                    event.preventDefault();
                                })

                                return container;
                            }
                        });

                        // add control to leaflet
                        helpControl = new HelpControl();
                        viewer.addControl(helpControl);

                        event.preventDefault();
                    })

                    // show button status based on whether user is logged in.
                    if(this.options.disableButtons){
                        // disable buttons if user is not logged in
                        $(container).find('#leafletLikeButton').addClass('leaflet-disabled').attr('title', "You must be logged in");
                        $(container).find('#leafletDislikeButton').addClass('leaflet-disabled').attr('title', "You must be logged in");
                        $(container).attr('title', "You must be logged in");
                    } else {
                        // get user's image rating and update UI
                        this.options.userRatingUrl && $.ajax({
                            url: this.options.userRatingUrl,
                            success: function (data) {
                                switch (data.success){
                                    case 'LIKE':
                                        setLikeButton()
                                        break;
                                    case 'DISLIKE':
                                        setDislikeButton()
                                        break;
                                }
                            }
                        })
                    }

                    return container;
                }
            });

            viewer.addControl(new FeedbackControl());
        }

        if (opts.addLoading) {
            var loadingControl = L.Control.loading({
                separate: true
            });
            viewer.addControl(loadingControl);
        }

        // control to dismiss bootstrap modal dialog
        if (opts.addCloseButton) {
            var CloseControl = L.Control.extend({
                options: {
                    position: "topright",
                    title: 'Close this dialog'
                },
                onAdd: function (map) {
                    var container = L.DomUtil.create("div", "leaflet-bar");
                    var $container = $(container);
                    $container.html('<a id="closeLeafletModalButton" href="#" class="">&times;</a>');
                    $container.attr('title',"Close this dialog");
                    $container.find("#closeLeafletModalButton").click(function (e) {
                        e.preventDefault();
                        $(this).parents('.modal').modal('hide');
                    });
                    return container;
                }
            });

            viewer.addControl(new CloseControl());
        }

        // add attribution control to bottom right
        if (opts.addAttribution) {
            var AttributionControl = L.Control.extend({
                options: {
                    position: "bottomright",
                    title: 'Show attribution',
                    attribution: opts.attribution
                },
                onAdd: function (map) {
                    var container = L.DomUtil.create("div", "leaflet-control-layers");
                    this.container = container;
                    $(container).html("<div style='padding:10px'>" + this.options.attribution + "</div>");
                    return container;
                }
            });

            viewer.addControl(new AttributionControl());
        }

        if (opts.galleryOptions.enableGalleryMode) {

            if (opts.galleryOptions.closeControlContent) {
                var ClosePopupControl = L.Control.extend({
                    options: {
                        position: 'topright',
                        title: 'Close gallery',
                        content: opts.galleryOptions.closeControlContent
                    },

                    onAdd: function (map) {
                        var options = this.options;
                        var hiddenClass = window.fullScreenApi.isFullScreen() ? 'hidden' : '';
                        var container = L.DomUtil.create('div', 'leaflet-control-close-popup leaflet-bar leaflet-control ' + hiddenClass);
                        var link = L.DomUtil.create('a', '', container);
                        link.innerHTML = options.content;
                        link.href = '#';
                        container.title = options.title;
                        L.DomEvent.on(container, 'click', function () {
                            $('.leaflet-control-close-popup i').click();
                        });

                        return container;
                    }
                });

                viewer.addControl(new ClosePopupControl());
            }

            if (opts.galleryOptions.showFullScreenControls) {
                var ImgGalleryControlBar = L.Control.extend({
                    options: {
                        position: 'topright'
                    },
                    onAdd: function () {
                        var hiddenClass = window.fullScreenApi.isFullScreen() ? '' : 'hidden';
                        var container = L.DomUtil.create('div', 'leaflet-gallery-control-bar leaflet-bar leaflet-control leaflet-bar-horizontal ' + hiddenClass, this._control);

                        var previous = L.DomUtil.create('a', 'leaflet-control-previous', container);
                        previous.innerHTML = '<i class="fa fa-arrow-left" style="line-height:1.65;"></i>';
                        previous.title ='Got to previous image';

                        var next = L.DomUtil.create('a', 'leaflet-control-next', container);
                        next.innerHTML = '<i class="fa fa-arrow-right" style="line-height:1.65;"></i>';
                        next.title ='Got to next image';

                        return container;
                    }
                });

                viewer.addControl(new ImgGalleryControlBar());

            }

            $(document).off(window.fullScreenApi.fullScreenEventName);
            $(document).on(window.fullScreenApi.fullScreenEventName, function (e) {
                if (window.fullScreenApi.isFullScreen()) {
                    $('.leaflet-control-close-popup').addClass('hidden');
                    $('.leaflet-gallery-control-bar').removeClass('hidden');
                } else {
                    $('.leaflet-control-close-popup').removeClass('hidden');
                    $('.leaflet-gallery-control-bar').addClass('hidden');
                }
            });

            $(document).off('click', 'a.leaflet-control-previous');
            $(document).on('click', 'a.leaflet-control-previous', function () {
                var e = jQuery.Event("keydown");
                e.which = 37; // # Some key code value
                $(document).trigger(e);
            });

            $(document).off('click', 'a.leaflet-control-next');
            $(document).on('click', 'a.leaflet-control-next', function () {
                var e = jQuery.Event("keydown");
                e.which = 39; // # Some key code value
                $(document).trigger(e);
            });
        }
    }

    /*
    Define this div if bootbox is not working properly. 
    for eg: show.gsp in bie-plugin
    
     <div id="alertModal" class="modal fade" tabindex="-1" role="dialog">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-body">
                    <div id="alertContent"></div>
                    <!-- dialog buttons -->
                    <div class="modal-footer"><button type="button" class="btn btn-primary" data-dismiss="modal">OK</button></div>
                </div>
            </div><!-- /.modal-content -->
         </div><!-- /.modal-dialog -->
     </div>
     */
    function showAlert(alertMsg) {
        // if alertModal and alertContent is defined
        if ($("#alertModal").length && $("#alertContent").length) {
            $('#alertContent').text(alertMsg);
            $('#alertModal').modal('show');
        } else {
            bootbox.alert(alertMsg)
        }
    }

    function setPreferredButton(container) {
        $(container).find("#btnPreferredImage").css('color', 'orange').attr('title', 'You have added this image to ALA Preferred Image Species List');
    }

    function removePreferredButton() {
        $('#leafletLikeButton').css('color', 'black').attr('title', 'Add');
    }

    // set visual effects to show like status of image
    function setLikeButton() {
        $('#leafletLikeButton').removeClass('fa-thumbs-o-up').addClass('fa-thumbs-up').css('color', 'green').attr('title', 'You up voted this image');
        $('#leafletDislikeButton').addClass('fa-thumbs-o-down').removeClass('fa-thumbs-down').css('color', 'black').attr('title', 'Click to down vote this image');
    }

    // set visual effects to show dislike status of image
    function setDislikeButton() {
        $('#leafletLikeButton').removeClass('fa-thumbs-up').addClass('fa-thumbs-o-up').css('color', 'black').attr('title', 'Click to up vote this image');
        $('#leafletDislikeButton').addClass('fa-thumbs-down').removeClass('fa-thumbs-o-down').css('color', 'red').attr('title', 'You down voted this image!');
    }

    lib.showSubimages = function(){
        _imageOverlays.clearLayers(); //clear and reload
        $.ajax(imageServiceBaseUrl + "/ws/getSubimageRectangles/" + _imageId).done(function(results) {
            if (results.success) {
                for (var subimageIndex in results.subimages) {

                    var rect = results.subimages[subimageIndex];
                    var imageId = rect.imageId;
                    var lng1 = rect.x / _imageScaleFactor;
                    var lat1 = (_imageHeight - rect.y) / _imageScaleFactor;
                    var lng2 = (rect.x + rect.width) / _imageScaleFactor;
                    var lat2 = (_imageHeight - (rect.y + rect.height)) / _imageScaleFactor;
                    var bounds = [[lat1,lng1], [lat2, lng2]];

                    var feature = L.rectangle(bounds, { color: "#ff7800", weight: 1, imageId:imageId, className: imageId});
                    feature.addTo(_imageOverlays);
                    feature.on("click", function(e) {
                        var imageId = e.target.options.imageId;
                        if (imageId) {
                            window.location = imageServiceBaseUrl + "/image/" + imageId;
                        }
                    });

                    feature.on('mouseover', function (e) {

                        var popup = L.popup()
                            .setLatLng(e.latlng) //(assuming e.latlng returns the coordinates of the event)
                            .setContent('<p>Loading..' + e.target.options.imageId +'.</p>')
                            .openOn(_viewer);


                        console.log("Loading - "+ imageServiceBaseUrl + "/image/imageTooltipFragment?imageId=" + e.target.options.imageId)

                        $.ajax( imageServiceBaseUrl + "/image/imageTooltipFragment?imageId=" + e.target.options.imageId).then(function(content) {

                                // console.log(content);
                                popup.setContent(content);
                            },
                            function(xhr, status, error) {
                                console.log( status + ": " + error);
                            });
                    });
                    feature.on('mouseout', function (e) {
                        this.closePopup();
                    });
                }

                $(".subimage-path").each(function() {
                    var classNames = $(this).attr("class");
                    classNames = $.trim(classNames).split(" ");
                    // Work out the imageId
                    var imageId = "";
                    for (index in classNames) {
                        var className = classNames[index];
                        var matches = className.match(/imageId[-](.*)/);
                        if (matches) {
                            imageId = matches[1];
                            break;
                        }
                    }
                });
            }

            $('#btnViewSubimages').html('Hide&nbsp;subimages');
            $.data($('#btnViewSubimages'), 'switch', 'on');
        });
    }

    lib.hideSubimages = function(){
        _imageOverlays.clearLayers();
    }

    lib.toggleSubimages = function() {
        if($(this).data('switch') == 'off' || $(this).data('switch') === undefined){
            lib.showSubimages();
            $('#btnViewSubimages').html('Hide&nbsp;subimages');
            $.data(this, 'switch', 'on');
        } else {
            lib.hideSubimages();
            $('#btnViewSubimages').html('Show&nbsp;subimages');
            $.data(this, 'switch', 'off');
        }
    }

    /**
     * Returns the initial level of zoom for the image viewer. If initialZoom = 'auto' it will calculate the optimum zoom
     * level for the available space in the viewer container
     * @param initialZoom
     * @param maxZoom
     * @param image
     * @param container
     * @returns {*}
     */
    getInitialZoomLevel = function (initialZoom, zoomFudgeFactor, maxZoom, image, container) {
        var zoomLevel = maxZoom;
        if (initialZoom == 'auto') {
            var containerWidth = $(container).width();
            var containerHeight = $(container).height();
            var imageWidth = image.width;
            var imageHeight = image.height;
            if (imageWidth > imageHeight) {
                // Landscape photo
                while (containerWidth < (imageWidth * zoomFudgeFactor) && zoomLevel > 0) {
                    zoomLevel--;
                    imageWidth /= 2;
                }
            } else {
                // Portrait photo
                while (containerHeight < (imageHeight * zoomFudgeFactor) && zoomLevel > 0) {
                    zoomLevel--;
                    imageHeight /= 2;
                }
            }
        } else if ($.isNumeric(initialZoom) && Math.abs(initialZoom) <= maxZoom) {
            zoomLevel = Math.abs(initialZoom);
        }

        return zoomLevel
    };

    lib.showModal = function(options) {

        var opts = {
            backdrop: options.backdrop ? options.backdrop : true,
            keyboard: options.keyboard ? options.keyboard: true,
            url: options.url ? options.url : false,
            id: options.id ? options.id : 'modal_element_id',
            height: options.height ? options.height : 500,
            width: options.width ? options.width : 600,
            title: options.title ? options.title : 'Modal Title',
            hideHeader: options.hideHeader ? options.hideHeader : false,
            onClose: options.onClose ? options.onClose : null,
            onShown: options.onShown ? options.onShown : null,
            content: options.content
        };

        $("body").find('#' + opts.id).remove();

        var html = "<div id='" + opts.id + "' class='modal fade' role='dialog' tabindex='-1'>";
            html += '<div class="modal-dialog" role="document">';
                html += '<div class="modal-content">';
                    html += "<div class='modal-header'>";
                    var initialContent = opts.content ? opts.content : "Loading...";
                    if (!opts.hideHeader) {
                        html += "<h3 id='modal_label_" + opts.id + "' class='modal-title'>" + opts.title + "</h3>";
                    }
                    html += '</div>';
                    html += "<div  id='modal_content_" + opts.id + "' class='modal-body' >" + initialContent + "</div>";
                    html += '<div class="modal-footer"><button type="button" class="btn btn-default" data-dismiss="modal">Close</button></div>';
                html += '</div>';
            html += '</div>';
        html += '</div>';
        $("body").append(html);
        $("#modal_content_" + opts.id).load(opts.url);
        $("#" + opts.id).modal('show');
    };

    lib.hideModal = function() {
        $("#modal_element_id").modal('hide');
    };

    lib.areYouSureOptions = {};

    lib.areYouSure = function(options) {

        if (!options.title) {
            options.title = "Are you sure?"
        }

        if (!options.message) {
            options.message = options.title;
        }

        var modalOptions = {
            url: imageServiceBaseUrl + "/dialog/areYouSureFragment?message=" + encodeURIComponent(options.message),
            title: options.title
        };

        lib.areYouSureOptions.affirmativeAction = options.affirmativeAction;
        lib.areYouSureOptions.negativeAction = options.negativeAction;

        lib.showModal(modalOptions);
    };

    lib.onAlbumSelected = null;

    lib.selectAlbum = function(onSelectFunction) {
        var opts = {
            title: "Select an album",
            url: imageServiceBaseUrl + "/album/selectAlbumFragment"
        };
        lib.onAlbumSelected = function(albumId) {
            lib.hideModal();
            if (onSelectFunction) {
                onSelectFunction(albumId);
            }
        };
        lib.showModal(opts);
    };

    lib.onTagSelected = null;

    lib.onTagCreated = null;

    lib.selectTag = function(onSelectFunction) {
        var opts = {
            width: 700,
            title: "Select a tag",
            url: imageServiceBaseUrl + "/tag/selectTagFragment"
        };

        lib.onTagSelected = function(tagId) {
            lib.hideModal();
            if (onSelectFunction) {
                onSelectFunction(tagId);
            }
        };
        lib.showModal(opts);
    };

    lib.createNewTag = function(parentTagId, onCreatedFunction) {

        var opts = {
            title: "Create new tag from path",
            url: imageServiceBaseUrl + "/tag/createTagFragment?parentTagId=" + parentTagId
        };

        lib.onTagCreated = function(tagId) {
            lib.hideModal();
            if (onCreatedFunction) {
                onCreatedFunction(tagId);
            }
        };
        lib.showModal(opts);
    };

    lib.onAddMetadata = null;

    lib.promptForMetadata = function(onMetadata) {

        var opts = {
            title: "Add meta data item",
            url: imageServiceBaseUrl + "/dialog/addUserMetadataFragment"
        };

        lib.onAddMetadata = function(key, value) {
            lib.hideModal();
            if (onMetadata) {
                onMetadata(key, value);
            }
        };

        lib.showModal(opts);
    };

    lib.bindImageTagTooltips = function() {
        $(".image-tags-button").each(function() {
            var imageId = $(this).closest("[imageId]").attr("imageId");
            if (imageId) {
                $(this).qtip({
                    content: {
                        text: function(event, api) {
                            $.ajax(imageServiceBaseUrl + "/image/imageTagsTooltipFragment/" + imageId).then(function(content) {
                                    api.set("content.text", content);
                                },
                                function(xhr, status, error) {
                                    api.set("content.text", status + ": " + error);
                                });
                        }
                    }
                });
            }
        });
    };

    lib.htmlEscape = function(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    };

    lib.htmlUnescape = function(value) {
        return String(value)
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&');
    };

    lib.showSpinner = function(message) {
        var spinner = $(".spinner");
        if (message) {
            spinner.attr("title", message);
        } else {
            spinner.attr("title", "");
        }
        spinner.css("display", "block");
    };

    lib.hideSpinner = function() {
        var spinner = $(".spinner");
        spinner.css("display", "none");
    };

    lib.bindTooltips = function(selector, width) {

        if (!selector) {
            selector = "a.fieldHelp";
        }
        if (!width) {
            width = 300;
        }
        // Context sensitive help popups
        $(selector).each(function() {


            var tooltipPosition = $(this).attr("tooltipPosition");
            if (!tooltipPosition) {
                tooltipPosition = "bottomRight";
            }

            var targetPosition = $(this).attr("targetPosition");
            if (!targetPosition) {
                targetPosition = "topMiddle";
            }
            var tipPosition = $(this).attr("tipPosition");
            if (!tipPosition) {
                tipPosition = "bottomRight";
            }

            var elemWidth = $(this).attr("width");
            if (elemWidth) {
                width = elemWidth;
            }

            $(this).qtip({
                tip: true,
                position: {
                    corner: {
                        target: targetPosition,
                        tooltip: tooltipPosition
                    }
                },
                style: {
                    width: width,
                    padding: 8,
                    background: 'white', //'#f0f0f0',
                    color: 'black',
                    textAlign: 'left',
                    border: {
                        width: 4,
                        radius: 5,
                        color: '#E66542'// '#E66542' '#DD3102'
                    },
                    tip: tipPosition,
                    name: 'light' // Inherit the rest of the attributes from the preset light style
                }
            }).bind('click', function(e){ e.preventDefault(); return false; });

        });
    };
})(imgvwr);
