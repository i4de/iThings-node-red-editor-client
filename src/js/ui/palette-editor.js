/**
 * Copyright JS Foundation and other contributors, http://js.foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/
RED.palette.editor = (function() {

    var disabled = false;

    var editorTabs;
    var filterInput;
    var searchInput;
    var nodeList;
    var packageList;
    var loadedList = [];
    var filteredList = [];
    var loadedIndex = {};

    var typesInUse = {};
    var nodeEntries = {};
    var eventTimers = {};
    var activeFilter = "";

    var semverre = /^(\d+)(\.(\d+))?(\.(\d+))?(-([0-9A-Za-z-]+))?(\.([0-9A-Za-z-.]+))?$/;
    var NUMBERS_ONLY = /^\d+$/;

    function SemVerPart(part) {
        this.number = 0;
        this.text = part;
        if ( NUMBERS_ONLY.test(part)){
            this.number = parseInt(part);
            this.type = "N";
        } else {
            this.type = part == undefined || part.length < 1 ? "E" : "T";
        }
    }

    SemVerPart.prototype.compare = function(other) {
        var types = this.type + other.type;
        switch ( types ) {
            case "EE": return 0;
            case "NT":
            case "TE":
            case "EN": return -1;
            case "NN": return this.number - other.number;
            case "TT": return this.text.localeCompare( other.text );
            case "ET":
            case "TN":
            case "NE": return 1;
        }
    };

    function SemVer(ver) {
        var groups = ver.match( semverre );
        this.parts = [ new SemVerPart( groups[1] ), new SemVerPart( groups[3] ), new SemVerPart( groups[5] ), new SemVerPart( groups[7] ), new SemVerPart( groups[9] ) ];
    }

    SemVer.prototype.compare = function(other) {
        var result = 0;
        for ( var i = 0, n = this.parts.length; result == 0 && i < n; i++ ) {
            result = this.parts[ i ].compare( other.parts[ i ] );
        }
        return result;
    };

    function semVerCompare(ver1, ver2) {
        var semver1 = new SemVer(ver1);
        var semver2 = new SemVer(ver2);
        var result = semver1.compare(semver2);
        return result;
    }

    function delayCallback(start,callback) {
        var delta = Date.now() - start;
        if (delta < 300) {
            delta = 300;
        } else {
            delta = 0;
        }
        setTimeout(function() {
            callback();
        },delta);
    }
    function changeNodeState(id,state,shade,callback) {
        shade.show();
        var start = Date.now();
        $.ajax({
            url:"nodes/"+id,
            type: "PUT",
            data: JSON.stringify({
                enabled: state
            }),
            contentType: "application/json; charset=utf-8"
        }).done(function(data,textStatus,xhr) {
            delayCallback(start,function() {
                shade.hide();
                callback();
            });
        }).fail(function(xhr,textStatus,err) {
            delayCallback(start,function() {
                shade.hide();
                callback(xhr);
            });
        })
    }
    function installNodeModule(id,version,url,callback) {
        var requestBody = {
            module: id
        };
        if (version) {
            requestBody.version = version;
        }
        if (url) {
            requestBody.url = url;
        }
        $.ajax({
            url:"nodes",
            type: "POST",
            data: JSON.stringify(requestBody),
            contentType: "application/json; charset=utf-8"
        }).done(function(data,textStatus,xhr) {
            callback();
        }).fail(function(xhr,textStatus,err) {
            callback(xhr);
        });
    }
    function removeNodeModule(id,callback) {
        $.ajax({
            url:"nodes/"+id,
            type: "DELETE"
        }).done(function(data,textStatus,xhr) {
            callback();
        }).fail(function(xhr,textStatus,err) {
            callback(xhr);
        })
    }

    function refreshNodeModuleList() {
        for (var id in nodeEntries) {
            if (nodeEntries.hasOwnProperty(id)) {
                _refreshNodeModule(id);
            }
        }
    }

    function refreshNodeModule(module) {
        if (!eventTimers.hasOwnProperty(module)) {
            eventTimers[module] = setTimeout(function() {
                delete eventTimers[module];
                _refreshNodeModule(module);
            },100);
        }
    }


    function getContrastingBorder(rgbColor){
        var parts = /^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)[,)]/.exec(rgbColor);
        if (parts) {
            var r = parseInt(parts[1]);
            var g = parseInt(parts[2]);
            var b = parseInt(parts[3]);
            var yiq = ((r*299)+(g*587)+(b*114))/1000;
            if (yiq > 160) {
                r = Math.floor(r*0.8);
                g = Math.floor(g*0.8);
                b = Math.floor(b*0.8);
                return "rgb("+r+","+g+","+b+")";
            }
        }
        return rgbColor;
    }

    function formatUpdatedAt(dateString) {
        var now = new Date();
        var d = new Date(dateString);
        var delta = (Date.now() - new Date(dateString).getTime())/1000;

        if (delta < 60) {
            return RED._('palette.editor.times.seconds');
        }
        delta = Math.floor(delta/60);
        if (delta < 10) {
            return RED._('palette.editor.times.minutes');
        }
        if (delta < 60) {
            return RED._('palette.editor.times.minutesV',{count:delta});
        }

        delta = Math.floor(delta/60);

        if (delta < 24) {
            return RED._('palette.editor.times.hoursV',{count:delta});
        }

        delta = Math.floor(delta/24);

        if (delta < 7) {
            return RED._('palette.editor.times.daysV',{count:delta})
        }
        var weeks = Math.floor(delta/7);
        var days = delta%7;

        if (weeks < 4) {
            return RED._('palette.editor.times.weeksV',{count:weeks})
        }

        var months = Math.floor(weeks/4);
        weeks = weeks%4;

        if (months < 12) {
            return RED._('palette.editor.times.monthsV',{count:months})
        }
        var years = Math.floor(months/12);
        months = months%12;

        if (months === 0) {
            return RED._('palette.editor.times.yearsV',{count:years})
        } else {
            return RED._('palette.editor.times.year'+(years>1?'s':'')+'MonthsV',{y:years,count:months})
        }
    }


    function _refreshNodeModule(module) {
        if (!nodeEntries.hasOwnProperty(module)) {
            nodeEntries[module] = {info:RED.nodes.registry.getModule(module)};
            var index = [module];
            for (var s in nodeEntries[module].info.sets) {
                if (nodeEntries[module].info.sets.hasOwnProperty(s)) {
                    index.push(s);
                    index = index.concat(nodeEntries[module].info.sets[s].types)
                }
            }
            nodeEntries[module].index = index.join(",").toLowerCase();
            nodeList.editableList('addItem', nodeEntries[module]);
        } else {
            var moduleInfo = nodeEntries[module].info;
            var nodeEntry = nodeEntries[module].elements;
            if (nodeEntry) {
                var activeTypeCount = 0;
                var typeCount = 0;
                var errorCount = 0;
                nodeEntry.errorList.empty();
                nodeEntries[module].totalUseCount = 0;
                nodeEntries[module].setUseCount = {};

                for (var setName in moduleInfo.sets) {
                    if (moduleInfo.sets.hasOwnProperty(setName)) {
                        var inUseCount = 0;
                        var set = moduleInfo.sets[setName];
                        var setElements = nodeEntry.sets[setName];
                        if (set.err) {
                            errorCount++;
                            var errMessage = set.err;
                            if (set.err.message) {
                                errMessage = set.err.message;
                            } else if (set.err.code) {
                                errMessage = set.err.code;
                            }
                            $("<li>").text(errMessage).appendTo(nodeEntry.errorList);
                        }
                        if (set.enabled) {
                            activeTypeCount += set.types.length;
                        }
                        typeCount += set.types.length;
                        for (var i=0;i<moduleInfo.sets[setName].types.length;i++) {
                            var t = moduleInfo.sets[setName].types[i];
                            inUseCount += (typesInUse[t]||0);
                            var swatch = setElements.swatches[t];
                            if (set.enabled) {
                                var def = RED.nodes.getType(t);
                                if (def && def.color) {
                                    swatch.css({background:RED.utils.getNodeColor(t,def)});
                                    swatch.css({border: "1px solid "+getContrastingBorder(swatch.css('backgroundColor'))})
                                }
                            }
                        }
                        nodeEntries[module].setUseCount[setName] = inUseCount;
                        nodeEntries[module].totalUseCount += inUseCount;

                        if (inUseCount > 0) {
                            setElements.enableButton.text(RED._('palette.editor.inuse'));
                            setElements.enableButton.addClass('disabled');
                        } else {
                            setElements.enableButton.removeClass('disabled');
                            if (set.enabled) {
                                setElements.enableButton.text(RED._('palette.editor.disable'));
                            } else {
                                setElements.enableButton.text(RED._('palette.editor.enable'));
                            }
                        }
                        setElements.setRow.toggleClass("red-ui-palette-module-set-disabled",!set.enabled);
                    }
                }

                if (errorCount === 0) {
                    nodeEntry.errorRow.hide()
                } else {
                    nodeEntry.errorRow.show();
                }

                var nodeCount = (activeTypeCount === typeCount)?typeCount:activeTypeCount+" / "+typeCount;
                nodeEntry.setCount.text(RED._('palette.editor.nodeCount',{count:typeCount,label:nodeCount}));

                if (nodeEntries[module].totalUseCount > 0) {
                    nodeEntry.enableButton.text(RED._('palette.editor.inuse'));
                    nodeEntry.enableButton.addClass('disabled');
                    nodeEntry.removeButton.hide();
                } else {
                    nodeEntry.enableButton.removeClass('disabled');
                    if (moduleInfo.local) {
                        nodeEntry.removeButton.css('display', 'inline-block');
                    }
                    if (activeTypeCount === 0) {
                        nodeEntry.enableButton.text(RED._('palette.editor.enableall'));
                    } else {
                        nodeEntry.enableButton.text(RED._('palette.editor.disableall'));
                    }
                    nodeEntry.container.toggleClass("disabled",(activeTypeCount === 0));
                }
            }
            if (moduleInfo.pending_version) {
                nodeEntry.versionSpan.html(moduleInfo.version+' <i class="fa fa-long-arrow-right"></i> '+moduleInfo.pending_version).appendTo(nodeEntry.metaRow)
                nodeEntry.updateButton.text(RED._('palette.editor.updated')).addClass('disabled').css('display', 'inline-block');
            } else if (loadedIndex.hasOwnProperty(module)) {
                if (updateAllowed &&
                    semVerCompare(loadedIndex[module].version,moduleInfo.version) > 0 &&
                    RED.utils.checkModuleAllowed(module,null,updateAllowList,updateDenyList)
                ) {
                    nodeEntry.updateButton.show();
                    nodeEntry.updateButton.text(RED._('palette.editor.update',{version:loadedIndex[module].version}));
                } else {
                    nodeEntry.updateButton.hide();
                }
            } else {
                nodeEntry.updateButton.hide();
            }
        }

    }

    function filterChange(val) {
        activeFilter = val.toLowerCase();
        var visible = nodeList.editableList('filter');
        var size = nodeList.editableList('length');
        if (val === "") {
            filterInput.searchBox('count');
        } else {
            filterInput.searchBox('count',visible+" / "+size);
        }
    }


    var catalogueCount;
    var catalogueLoadStatus = [];
    var catalogueLoadStart;
    var catalogueLoadErrors = false;

    var activeSort = sortModulesRelevance;

    function handleCatalogResponse(err,catalog,index,v) {
        catalogueLoadStatus.push(err||v);
        if (!err) {
            if (v.modules) {
                var a = false;
                v.modules = v.modules.filter(function(m) {
                    if (RED.utils.checkModuleAllowed(m.id,m.version,installAllowList,installDenyList)) {
                        loadedIndex[m.id] = m;
                        m.index = [m.id];
                        if (m.keywords) {
                            m.index = m.index.concat(m.keywords);
                        }
                        if (m.types) {
                            m.index = m.index.concat(m.types);
                        }
                        if (m.updated_at) {
                            m.timestamp = new Date(m.updated_at).getTime();
                        } else {
                            m.timestamp = 0;
                        }
                        m.index = m.index.join(",").toLowerCase();
                        return true;
                    }
                    return false;
                })
                loadedList = loadedList.concat(v.modules);
            }
            searchInput.searchBox('count',loadedList.length);
        } else {
            catalogueLoadErrors = true;
        }
        if (catalogueCount > 1) {
            $(".red-ui-palette-module-shade-status").html(RED._('palette.editor.loading')+"<br>"+catalogueLoadStatus.length+"/"+catalogueCount);
        }
        if (catalogueLoadStatus.length === catalogueCount) {
            if (catalogueLoadErrors) {
                RED.notify(RED._('palette.editor.errors.catalogLoadFailed',{url: catalog}),"error",false,8000);
            }
            var delta = 250-(Date.now() - catalogueLoadStart);
            setTimeout(function() {
                $("#red-ui-palette-module-install-shade").hide();
            },Math.max(delta,0));

        }
    }

    function initInstallTab() {
        if (loadedList.length === 0) {
            loadedList = [];
            loadedIndex = {};
            packageList.editableList('empty');

            $(".red-ui-palette-module-shade-status").text(RED._('palette.editor.loading'));
            var catalogues = RED.settings.theme('palette.catalogues')||['https://catalogue.nodered.org/catalogue.json'];
            catalogueLoadStatus = [];
            catalogueLoadErrors = false;
            catalogueCount = catalogues.length;
            if (catalogues.length > 1) {
                $(".red-ui-palette-module-shade-status").html(RED._('palette.editor.loading')+"<br>0/"+catalogues.length);
            }
            $("#red-ui-palette-module-install-shade").show();
            catalogueLoadStart = Date.now();
            var handled = 0;
            catalogues.forEach(function(catalog,index) {
                $.getJSON(catalog, {_: new Date().getTime()},function(v) {
                    handleCatalogResponse(null,catalog,index,v);
                    refreshNodeModuleList();
                }).fail(function(jqxhr, textStatus, error) {
                    console.warn("Error loading catalog",catalog,":",error);
                    handleCatalogResponse(jqxhr,catalog,index);
                }).always(function() {
                    handled++;
                    if (handled === catalogueCount) {
                        searchInput.searchBox('change');
                    }
                })
            });
        }
    }

    function refreshFilteredItems() {
        packageList.editableList('empty');
        var currentFilter = searchInput.searchBox('value').trim();
        if (currentFilter === ""){
            packageList.editableList('addItem',{count:loadedList.length})
            return;
        }
        filteredList.sort(activeSort);
        for (var i=0;i<Math.min(10,filteredList.length);i++) {
            packageList.editableList('addItem',filteredList[i]);
        }
        if (filteredList.length === 0) {
            packageList.editableList('addItem',{});
        }

        if (filteredList.length > 10) {
            packageList.editableList('addItem',{start:10,more:filteredList.length-10})
        }
    }
    function sortModulesRelevance(A,B) {
        var currentFilter = searchInput.searchBox('value').trim();
        if (currentFilter === "") {
            return sortModulesAZ(A,B);
        }
        var i = A.info.index.indexOf(currentFilter) - B.info.index.indexOf(currentFilter);
        if (i === 0) {
            return sortModulesAZ(A,B);
        }
        return i;
    }
    function sortModulesAZ(A,B) {
        return A.info.id.localeCompare(B.info.id);
    }
    function sortModulesRecent(A,B) {
        return -1 * (A.info.timestamp-B.info.timestamp);
    }

    var installAllowList = ['*'];
    var installDenyList = [];
    var updateAllowed = true;
    var updateAllowList = ['*'];
    var updateDenyList = [];

    function init() {
        if (RED.settings.get('externalModules.palette.allowInstall', true) === false) {
            return;
        }
        var settingsAllowList = RED.settings.get("externalModules.palette.allowList")
        var settingsDenyList = RED.settings.get("externalModules.palette.denyList")
        if (settingsAllowList || settingsDenyList) {
            installAllowList = settingsAllowList;
            installDenyList = settingsDenyList
        }
        installAllowList = RED.utils.parseModuleList(installAllowList);
        installDenyList = RED.utils.parseModuleList(installDenyList);

        var settingsUpdateAllowList = RED.settings.get("externalModules.palette.allowUpdateList")
        var settingsUpdateDenyList = RED.settings.get("externalModules.palette.denyUpdateList")
        if (settingsUpdateAllowList || settingsUpdateDenyList) {
            updateAllowList = settingsUpdateAllowList;
            updateDenyList = settingsUpdateDenyList;
        }
        updateAllowList = RED.utils.parseModuleList(updateAllowList);
        updateDenyList = RED.utils.parseModuleList(updateDenyList);
        updateAllowed = RED.settings.get("externalModules.palette.allowUpdate",true);


        createSettingsPane();

        RED.userSettings.add({
            id:'palette',
            title: RED._("palette.editor.palette"),
            get: getSettingsPane,
            close: function() {
                settingsPane.detach();
            },
            focus: function() {
                editorTabs.resize();
                setTimeout(function() {
                    filterInput.trigger("focus");
                },200);
            }
        })

        RED.actions.add("core:manage-palette",function() {
                RED.userSettings.show('palette');
            });

        RED.events.on('registry:module-updated', function(ns) {
            refreshNodeModule(ns.module);
        });
        RED.events.on('registry:node-set-enabled', function(ns) {
            refreshNodeModule(ns.module);
        });
        RED.events.on('registry:node-set-disabled', function(ns) {
            refreshNodeModule(ns.module);
        });
        RED.events.on('registry:node-type-added', function(nodeType) {
            if (!/^subflow:/.test(nodeType)) {
                var ns = RED.nodes.registry.getNodeSetForType(nodeType);
                refreshNodeModule(ns.module);
            }
        });
        RED.events.on('registry:node-type-removed', function(nodeType) {
            if (!/^subflow:/.test(nodeType)) {
                var ns = RED.nodes.registry.getNodeSetForType(nodeType);
                refreshNodeModule(ns.module);
            }
        });
        RED.events.on('registry:node-set-added', function(ns) {
            refreshNodeModule(ns.module);
            for (var i=0;i<filteredList.length;i++) {
                if (filteredList[i].info.id === ns.module) {
                    var installButton = filteredList[i].elements.installButton;
                    installButton.addClass('disabled');
                    installButton.text(RED._('palette.editor.installed'));
                    break;
                }
            }
        });
        RED.events.on('registry:node-set-removed', function(ns) {
            var module = RED.nodes.registry.getModule(ns.module);
            if (!module) {
                var entry = nodeEntries[ns.module];
                if (entry) {
                    nodeList.editableList('removeItem', entry);
                    delete nodeEntries[ns.module];
                    for (var i=0;i<filteredList.length;i++) {
                        if (filteredList[i].info.id === ns.module) {
                            var installButton = filteredList[i].elements.installButton;
                            installButton.removeClass('disabled');
                            installButton.text(RED._('palette.editor.install'));
                            break;
                        }
                    }
                }
            }
        });
        RED.events.on('nodes:add', function(n) {
            if (!/^subflow:/.test(n.type)) {
                typesInUse[n.type] = (typesInUse[n.type]||0)+1;
                if (typesInUse[n.type] === 1) {
                    var ns = RED.nodes.registry.getNodeSetForType(n.type);
                    refreshNodeModule(ns.module);
                }
            }
        })
        RED.events.on('nodes:remove', function(n) {
            if (typesInUse.hasOwnProperty(n.type)) {
                typesInUse[n.type]--;
                if (typesInUse[n.type] === 0) {
                    delete typesInUse[n.type];
                    var ns = RED.nodes.registry.getNodeSetForType(n.type);
                    refreshNodeModule(ns.module);
                }
            }
        })
    }

    var settingsPane;

    function getSettingsPane() {
        initInstallTab();
        editorTabs.activateTab('nodes');
        return settingsPane;
    }

    function createSettingsPane() {
        settingsPane = $('<div id="red-ui-settings-tab-palette"></div>');
        var content = $('<div id="red-ui-palette-editor">'+
            '<ul id="red-ui-palette-editor-tabs"></ul>'+
        '</div>').appendTo(settingsPane);

        editorTabs = RED.tabs.create({
            element: settingsPane.find('#red-ui-palette-editor-tabs'),
            onchange:function(tab) {
                content.find(".red-ui-palette-editor-tab").hide();
                tab.content.show();
                if (filterInput) {
                    filterInput.searchBox('value',"");
                }
                if (searchInput) {
                    searchInput.searchBox('value',"");
                }
                if (tab.id === 'install') {
                    if (searchInput) {
                        searchInput.trigger("focus");
                    }
                } else {
                    if (filterInput) {
                        filterInput.trigger("focus");
                    }
                }
            },
            minimumActiveTabWidth: 110
        });

        createNodeTab(content);
        createInstallTab(content);
    }

    function createNodeTab(content) {
        var modulesTab = $('<div>',{class:"red-ui-palette-editor-tab"}).appendTo(content);

        editorTabs.addTab({
            id: 'nodes',
            label: RED._('palette.editor.tab-nodes'),
            content: modulesTab
        })

        var filterDiv = $('<div>',{class:"red-ui-palette-search"}).appendTo(modulesTab);
        filterInput = $('<input type="text" data-i18n="[placeholder]palette.filter"></input>')
            .appendTo(filterDiv)
            .searchBox({
                delay: 200,
                change: function() {
                    filterChange($(this).val());
                }
            });


        nodeList = $('<ol>',{id:"red-ui-palette-module-list", style:"position: absolute;top: 35px;bottom: 0;left: 0;right: 0px;"}).appendTo(modulesTab).editableList({
            addButton: false,
            scrollOnAdd: false,
            sort: function(A,B) {
                return A.info.name.localeCompare(B.info.name);
            },
            filter: function(data) {
                if (activeFilter === "" ) {
                    return true;
                }

                return (activeFilter==="")||(data.index.indexOf(activeFilter) > -1);
            },
            addItem: function(container,i,object) {
                var entry = object.info;
                if (entry) {
                    var headerRow = $('<div>',{class:"red-ui-palette-module-header"}).appendTo(container);
                    var titleRow = $('<div class="red-ui-palette-module-meta red-ui-palette-module-name"><i class="fa fa-cube"></i></div>').appendTo(headerRow);
                    $('<span>').text(entry.name).appendTo(titleRow);
                    var metaRow = $('<div class="red-ui-palette-module-meta red-ui-palette-module-version"><i class="fa fa-tag"></i></div>').appendTo(headerRow);
                    var versionSpan = $('<span>').text(entry.version).appendTo(metaRow);

                    var errorRow = $('<div class="red-ui-palette-module-meta red-ui-palette-module-errors"><i class="fa fa-warning"></i></div>').hide().appendTo(headerRow);
                    var errorList = $('<ul class="red-ui-palette-module-error-list"></ul>').appendTo(errorRow);
                    var buttonRow = $('<div>',{class:"red-ui-palette-module-meta"}).appendTo(headerRow);
                    var setButton = $('<a href="#" class="red-ui-button red-ui-button-small red-ui-palette-module-set-button"><i class="fa fa-angle-right red-ui-palette-module-node-chevron"></i> </a>').appendTo(buttonRow);
                    var setCount = $('<span>').appendTo(setButton);
                    var buttonGroup = $('<div>',{class:"red-ui-palette-module-button-group"}).appendTo(buttonRow);

                    var updateButton = $('<a href="#" class="red-ui-button red-ui-button-small"></a>').text(RED._('palette.editor.update')).appendTo(buttonGroup);
                    updateButton.attr('id','up_'+Math.floor(Math.random()*1000000000));
                    updateButton.on("click", function(evt) {
                        evt.preventDefault();
                        if ($(this).hasClass('disabled')) {
                            return;
                        }
                        update(entry,loadedIndex[entry.name].version,loadedIndex[entry.name].pkg_url,container,function(err){});
                    })


                    var removeButton = $('<a href="#" class="red-ui-button red-ui-button-small"></a>').text(RED._('palette.editor.remove')).appendTo(buttonGroup);
                    removeButton.attr('id','up_'+Math.floor(Math.random()*1000000000));
                    removeButton.on("click", function(evt) {
                        evt.preventDefault();
                        remove(entry,container,function(err){});
                    })
                    if (!entry.local) {
                        removeButton.hide();
                    }
                    var enableButton = $('<a href="#" class="red-ui-button red-ui-button-small"></a>').text(RED._('palette.editor.disableall')).appendTo(buttonGroup);

                    var contentRow = $('<div>',{class:"red-ui-palette-module-content"}).appendTo(container);
                    var shade = $('<div class="red-ui-palette-module-shade hide"><img src="' + RED.resource.url("images/spin.svg") + '" class="red-ui-palette-spinner"/></div>').appendTo(container);

                    object.elements = {
                        updateButton: updateButton,
                        removeButton: removeButton,
                        enableButton: enableButton,
                        errorRow: errorRow,
                        errorList: errorList,
                        setCount: setCount,
                        container: container,
                        shade: shade,
                        versionSpan: versionSpan,
                        sets: {}
                    }
                    setButton.on("click", function(evt) {
                        evt.preventDefault();
                        if (container.hasClass('expanded')) {
                            container.removeClass('expanded');
                            contentRow.slideUp();
                        } else {
                            container.addClass('expanded');
                            contentRow.slideDown();
                        }
                    })

                    var setList = Object.keys(entry.sets)
                    setList.sort(function(A,B) {
                        return A.toLowerCase().localeCompare(B.toLowerCase());
                    });
                    setList.forEach(function(setName) {
                        var set = entry.sets[setName];
                        var setRow = $('<div>',{class:"red-ui-palette-module-set"}).appendTo(contentRow);
                        var buttonGroup = $('<div>',{class:"red-ui-palette-module-set-button-group"}).appendTo(setRow);
                        var typeSwatches = {};
                        set.types.forEach(function(t) {
                            var typeDiv = $('<div>',{class:"red-ui-palette-module-type"}).appendTo(setRow);
                            typeSwatches[t] = $('<span>',{class:"red-ui-palette-module-type-swatch"}).appendTo(typeDiv);
                            $('<span>',{class:"red-ui-palette-module-type-node"}).text(t).appendTo(typeDiv);
                        })
                        var enableButton = $('<a href="#" class="red-ui-button red-ui-button-small"></a>').appendTo(buttonGroup);
                        enableButton.on("click", function(evt) {
                            evt.preventDefault();
                            if (object.setUseCount[setName] === 0) {
                                var currentSet = RED.nodes.registry.getNodeSet(set.id);
                                shade.show();
                                var newState = !currentSet.enabled
                                changeNodeState(set.id,newState,shade,function(xhr){
                                    if (xhr) {
                                        if (xhr.responseJSON) {
                                            RED.notify(RED._('palette.editor.errors.'+(newState?'enable':'disable')+'Failed',{module: id,message:xhr.responseJSON.message}));
                                        }
                                    }
                                });
                            }
                        })

                        object.elements.sets[set.name] = {
                            setRow: setRow,
                            enableButton: enableButton,
                            swatches: typeSwatches
                        };
                    });
                    enableButton.on("click", function(evt) {
                        evt.preventDefault();
                        if (object.totalUseCount === 0) {
                            changeNodeState(entry.name,(container.hasClass('disabled')),shade,function(xhr){
                                if (xhr) {
                                    if (xhr.responseJSON) {
                                        RED.notify(RED._('palette.editor.errors.installFailed',{module: id,message:xhr.responseJSON.message}));
                                    }
                                }
                            });
                        }
                    })
                    refreshNodeModule(entry.name);
                } else {
                    $('<div>',{class:"red-ui-search-empty"}).text(RED._('search.empty')).appendTo(container);
                }
            }
        });
    }

    function createInstallTab(content) {
        var installTab = $('<div>',{class:"red-ui-palette-editor-tab hide"}).appendTo(content);

        editorTabs.addTab({
            id: 'install',
            label: RED._('palette.editor.tab-install'),
            content: installTab
        })

        var toolBar = $('<div>',{class:"red-ui-palette-editor-toolbar"}).appendTo(installTab);

        var searchDiv = $('<div>',{class:"red-ui-palette-search"}).appendTo(installTab);
        searchInput = $('<input type="text" data-i18n="[placeholder]palette.search"></input>')
            .appendTo(searchDiv)
            .searchBox({
                delay: 300,
                change: function() {
                    var searchTerm = $(this).val().trim().toLowerCase();
                    if (searchTerm.length > 0) {
                        filteredList = loadedList.filter(function(m) {
                            return (m.index.indexOf(searchTerm) > -1);
                        }).map(function(f) { return {info:f}});
                        refreshFilteredItems();
                        searchInput.searchBox('count',filteredList.length+" / "+loadedList.length);
                    } else {
                        searchInput.searchBox('count',loadedList.length);
                        packageList.editableList('empty');
                        packageList.editableList('addItem',{count:loadedList.length});

                    }
                }
            });

        $('<span>').text(RED._("palette.editor.sort")+' ').appendTo(toolBar);
        var sortGroup = $('<span class="button-group"></span>').appendTo(toolBar);
        var sortRelevance = $('<a href="#" class="red-ui-palette-editor-install-sort-option red-ui-sidebar-header-button-toggle selected"><i class="fa fa-sort-amount-desc"></i></a>').appendTo(sortGroup);
        var sortAZ = $('<a href="#" class="red-ui-palette-editor-install-sort-option red-ui-sidebar-header-button-toggle" data-i18n="palette.editor.sortAZ"></a>').appendTo(sortGroup);
        var sortRecent = $('<a href="#" class="red-ui-palette-editor-install-sort-option red-ui-sidebar-header-button-toggle" data-i18n="palette.editor.sortRecent"></a>').appendTo(sortGroup);


        var sortOpts = [
            {button: sortRelevance, func: sortModulesRelevance},
            {button: sortAZ, func: sortModulesAZ},
            {button: sortRecent, func: sortModulesRecent}
        ]
        sortOpts.forEach(function(opt) {
            opt.button.on("click", function(e) {
                e.preventDefault();
                if ($(this).hasClass("selected")) {
                    return;
                }
                $(".red-ui-palette-editor-install-sort-option").removeClass("selected");
                $(this).addClass("selected");
                activeSort = opt.func;
                refreshFilteredItems();
            });
        });

        var refreshSpan = $('<span>').appendTo(toolBar);
        var refreshButton = $('<a href="#" class="red-ui-sidebar-header-button"><i class="fa fa-refresh"></i></a>').appendTo(refreshSpan);
        refreshButton.on("click", function(e) {
            e.preventDefault();
            loadedList = [];
            loadedIndex = {};
            initInstallTab();
        })
        RED.popover.tooltip(refreshButton,RED._("palette.editor.refresh"));

        packageList = $('<ol>',{style:"position: absolute;top: 79px;bottom: 0;left: 0;right: 0px;"}).appendTo(installTab).editableList({
            addButton: false,
            scrollOnAdd: false,
            addItem: function(container,i,object) {
                if (object.count) {
                    $('<div>',{class:"red-ui-search-empty"}).text(RED._('palette.editor.moduleCount',{count:object.count})).appendTo(container);
                    return
                }
                if (object.more) {
                    container.addClass('red-ui-palette-module-more');
                    var moreRow = $('<div>',{class:"red-ui-palette-module-header palette-module"}).appendTo(container);
                    var moreLink = $('<a href="#"></a>').text(RED._('palette.editor.more',{count:object.more})).appendTo(moreRow);
                    moreLink.on("click", function(e) {
                        e.preventDefault();
                        packageList.editableList('removeItem',object);
                        for (var i=object.start;i<Math.min(object.start+10,object.start+object.more);i++) {
                            packageList.editableList('addItem',filteredList[i]);
                        }
                        if (object.more > 10) {
                            packageList.editableList('addItem',{start:object.start+10, more:object.more-10})
                        }
                    })
                    return;
                }
                if (object.info) {
                    var entry = object.info;
                    var headerRow = $('<div>',{class:"red-ui-palette-module-header"}).appendTo(container);
                    var titleRow = $('<div class="red-ui-palette-module-meta red-ui-palette-module-name"><i class="fa fa-cube"></i></div>').appendTo(headerRow);
                    $('<span>').text(entry.name||entry.id).appendTo(titleRow);
                    $('<a target="_blank" class="red-ui-palette-module-link"><i class="fa fa-external-link"></i></a>').attr('href',entry.url).appendTo(titleRow);
                    var descRow = $('<div class="red-ui-palette-module-meta"></div>').appendTo(headerRow);
                    $('<div>',{class:"red-ui-palette-module-description"}).text(entry.description).appendTo(descRow);
                    var metaRow = $('<div class="red-ui-palette-module-meta"></div>').appendTo(headerRow);
                    $('<span class="red-ui-palette-module-version"><i class="fa fa-tag"></i> '+entry.version+'</span>').appendTo(metaRow);
                    $('<span class="red-ui-palette-module-updated"><i class="fa fa-calendar"></i> '+formatUpdatedAt(entry.updated_at)+'</span>').appendTo(metaRow);

                    var duplicateType = false;
                    if (entry.types && entry.types.length > 0) {

                        for (var i=0;i<entry.types.length;i++) {
                            var nodeset = RED.nodes.registry.getNodeSetForType(entry.types[i]);
                            if (nodeset) {
                                duplicateType = nodeset.module;
                                break;
                            }
                        }
                        // $('<div>',{class:"red-ui-palette-module-meta"}).text(entry.types.join(",")).appendTo(headerRow);
                    }

                    var buttonRow = $('<div>',{class:"red-ui-palette-module-meta"}).appendTo(headerRow);
                    var buttonGroup = $('<div>',{class:"red-ui-palette-module-button-group"}).appendTo(buttonRow);
                    var installButton = $('<a href="#" class="red-ui-button red-ui-button-small"></a>').text(RED._('palette.editor.install')).appendTo(buttonGroup);
                    installButton.on("click", function(e) {
                        e.preventDefault();
                        if (!$(this).hasClass('disabled')) {
                            install(entry,container,function(xhr) {});
                        }
                    })
                    if (nodeEntries.hasOwnProperty(entry.id)) {
                        installButton.addClass('disabled');
                        installButton.text(RED._('palette.editor.installed'));
                    } else if (duplicateType) {
                        installButton.addClass('disabled');
                        installButton.text(RED._('palette.editor.conflict'));
                        RED.popover.create({
                            target:installButton,
                            content: RED._('palette.editor.conflictTip',{module:duplicateType}),
                            trigger:"hover",
                            direction:"bottom",
                            delay:{show:750,hide:50}
                        })
                    }

                    object.elements = {
                        installButton:installButton
                    }
                } else {
                    $('<div>',{class:"red-ui-search-empty"}).text(RED._('search.empty')).appendTo(container);
                }
            }
        });

        if (RED.settings.get('externalModules.palette.allowUpload', true) !== false) {
            var uploadSpan = $('<span class="button-group">').prependTo(toolBar);
            var uploadButton = $('<button type="button" class="red-ui-sidebar-header-button red-ui-palette-editor-upload-button"><label><i class="fa fa-upload"></i><form id="red-ui-palette-editor-upload-form" enctype="multipart/form-data"><input name="tarball" type="file" accept=".tgz"></label></button>').appendTo(uploadSpan);

            var uploadInput = uploadButton.find('input[type="file"]');
            uploadInput.on("change", function(evt) {
                if (this.files.length > 0) {
                    uploadFilenameLabel.text(this.files[0].name)
                    uploadToolbar.slideDown(200);
                }
            })

            var uploadToolbar = $('<div class="red-ui-palette-editor-upload"></div>').appendTo(installTab);
            var uploadForm = $('<div>').appendTo(uploadToolbar);
            var uploadFilename = $('<div class="placeholder-input"><i class="fa fa-upload"></i> </div>').appendTo(uploadForm);
            var uploadFilenameLabel = $('<span></span>').appendTo(uploadFilename);
            var uploadButtons = $('<div class="red-ui-palette-editor-upload-buttons"></div>').appendTo(uploadForm);
            $('<button class="editor-button"></button>').text(RED._("common.label.cancel")).appendTo(uploadButtons).on("click", function(evt) {
                evt.preventDefault();
                uploadToolbar.slideUp(200);
                uploadInput.val("");
            });
            $('<button class="editor-button primary"></button>').text(RED._("common.label.upload")).appendTo(uploadButtons).on("click", function(evt) {
                evt.preventDefault();

                var spinner = RED.utils.addSpinnerOverlay(uploadToolbar, true);
                var buttonRow = $('<div style="position: relative;bottom: calc(50% + 17px); padding-right: 10px;text-align: right;"></div>').appendTo(spinner);
                $('<button class="red-ui-button"></button>').text(RED._("eventLog.view")).appendTo(buttonRow).on("click", function(evt) {
                    evt.preventDefault();
                    RED.actions.invoke("core:show-event-log");
                });
                RED.eventLog.startEvent(RED._("palette.editor.confirm.button.install")+" : "+uploadInput[0].files[0].name);

                var data = new FormData();
                data.append("tarball",uploadInput[0].files[0]);
                var filename = uploadInput[0].files[0].name;
                $.ajax({
                    url: 'nodes',
                    data: data,
                    cache: false,
                    contentType: false,
                    processData: false,
                    method: 'POST',
                }).always(function(data,textStatus,xhr) {
                    spinner.remove();
                    uploadInput.val("");
                    uploadToolbar.slideUp(200);
                }).fail(function(xhr,textStatus,err) {
                    var message = textStatus;
                    if (xhr.responseJSON) {
                        message = xhr.responseJSON.message;
                    }
                    var notification = RED.notify(RED._('palette.editor.errors.installFailed',{module: filename,message:message}),{
                        type: 'error',
                        modal: true,
                        fixed: true,
                        buttons: [
                            {
                                text: RED._("common.label.close"),
                                click: function() {
                                    notification.close();
                                }
                            },{
                                text: RED._("eventLog.view"),
                                click: function() {
                                    notification.close();
                                    RED.actions.invoke("core:show-event-log");
                                }
                            }
                        ]
                    });
                    uploadInput.val("");
                    uploadToolbar.slideUp(200);
                })
            })
            RED.popover.tooltip(uploadButton,RED._("palette.editor.upload"));
        }

        $('<div id="red-ui-palette-module-install-shade" class="red-ui-palette-module-shade hide"><div class="red-ui-palette-module-shade-status"></div><img src="' + RED.resource.url("images/spin.svg") + '" class="red-ui-palette-spinner"/></div>').appendTo(installTab);
    }

    function update(entry,version,url,container,done) {
        if (RED.settings.get('externalModules.palette.allowInstall', true) === false) {
            done(new Error('Palette not editable'));
            return;
        }
        var notification = RED.notify(RED._("palette.editor.confirm.update.body",{module:entry.name}),{
            modal: true,
            fixed: true,
            buttons: [
                {
                    text: RED._("common.label.cancel"),
                    click: function() {
                        notification.close();
                    }
                },
                {
                    text: RED._("palette.editor.confirm.button.update"),
                    class: "primary red-ui-palette-module-install-confirm-button-update",
                    click: function() {
                        var spinner = RED.utils.addSpinnerOverlay(container, true);
                        var buttonRow = $('<div style="position: relative;bottom: calc(50% + 17px); padding-right: 10px;text-align: right;"></div>').appendTo(spinner);
                        $('<button class="red-ui-button"></button>').text(RED._("eventLog.view")).appendTo(buttonRow).on("click", function(evt) {
                            evt.preventDefault();
                            RED.actions.invoke("core:show-event-log");
                        });
                        RED.eventLog.startEvent(RED._("palette.editor.confirm.button.install")+" : "+entry.name+" "+version);
                        installNodeModule(entry.name,version,url,function(xhr) {
                            spinner.remove();
                            if (xhr) {
                                if (xhr.responseJSON) {
                                    var notification = RED.notify(RED._('palette.editor.errors.updateFailed',{module: entry.name,message:xhr.responseJSON.message}),{
                                        type: 'error',
                                        modal: true,
                                        fixed: true,
                                        buttons: [
                                            {
                                                text: RED._("common.label.close"),
                                                click: function() {
                                                    notification.close();
                                                }
                                            },{
                                                text: RED._("eventLog.view"),
                                                click: function() {
                                                    notification.close();
                                                    RED.actions.invoke("core:show-event-log");
                                                }
                                            }
                                        ]
                                    });
                                }
                            }
                            done(xhr);
                        });
                        notification.close();
                    }
                }
            ]
        })
    }
    function remove(entry,container,done) {
        if (RED.settings.get('externalModules.palette.allowInstall', true) === false) {
            done(new Error('Palette not editable'));
            return;
        }
        var notification = RED.notify(RED._("palette.editor.confirm.remove.body",{module:entry.name}),{
            modal: true,
            fixed: true,
            buttons: [
                {
                    text: RED._("common.label.cancel"),
                    click: function() {
                        notification.close();
                    }
                },
                {
                    text: RED._("palette.editor.confirm.button.remove"),
                    class: "primary red-ui-palette-module-install-confirm-button-remove",
                    click: function() {
                        var spinner = RED.utils.addSpinnerOverlay(container, true);
                        var buttonRow = $('<div style="position: relative;bottom: calc(50% + 17px); padding-right: 10px;text-align: right;"></div>').appendTo(spinner);
                        $('<button class="red-ui-button"></button>').text(RED._("eventLog.view")).appendTo(buttonRow).on("click", function(evt) {
                            evt.preventDefault();
                            RED.actions.invoke("core:show-event-log");
                        });
                        RED.eventLog.startEvent(RED._("palette.editor.confirm.button.remove")+" : "+entry.name);
                        removeNodeModule(entry.name, function(xhr) {
                            spinner.remove();
                            if (xhr) {
                                if (xhr.responseJSON) {
                                    var notification = RED.notify(RED._('palette.editor.errors.removeFailed',{module: entry.name,message:xhr.responseJSON.message}),{
                                        type: 'error',
                                        modal: true,
                                        fixed: true,
                                        buttons: [
                                            {
                                                text: RED._("common.label.close"),
                                                click: function() {
                                                    notification.close();
                                                }
                                            },{
                                                text: RED._("eventLog.view"),
                                                click: function() {
                                                    notification.close();
                                                    RED.actions.invoke("core:show-event-log");
                                                }
                                            }
                                        ]
                                    });                                }
                            }
                        })
                        notification.close();
                    }
                }
            ]
        })
    }
    function install(entry,container,done) {
        if (RED.settings.get('externalModules.palette.allowInstall', true) === false) {
            done(new Error('Palette not editable'));
            return;
        }
        var buttons = [
            {
                text: RED._("common.label.cancel"),
                click: function() {
                    notification.close();
                }
            }
        ];
        if (entry.url) {
            buttons.push({
                text: RED._("palette.editor.confirm.button.review"),
                class: "primary red-ui-palette-module-install-confirm-button-install",
                click: function() {
                    var url = entry.url||"";
                    window.open(url);
                }
            });
        }
        buttons.push({
            text: RED._("palette.editor.confirm.button.install"),
            class: "primary red-ui-palette-module-install-confirm-button-install",
            click: function() {
                var spinner = RED.utils.addSpinnerOverlay(container, true);

                var buttonRow = $('<div style="position: relative;bottom: calc(50% + 17px); padding-right: 10px;text-align: right;"></div>').appendTo(spinner);
                $('<button class="red-ui-button"></button>').text(RED._("eventLog.view")).appendTo(buttonRow).on("click", function(evt) {
                    evt.preventDefault();
                    RED.actions.invoke("core:show-event-log");
                });
                RED.eventLog.startEvent(RED._("palette.editor.confirm.button.install")+" : "+entry.id+" "+entry.version);
                installNodeModule(entry.id,entry.version,entry.pkg_url,function(xhr) {
                    spinner.remove();
                     if (xhr) {
                         if (xhr.responseJSON) {
                             var notification = RED.notify(RED._('palette.editor.errors.installFailed',{module: entry.id,message:xhr.responseJSON.message}),{
                                 type: 'error',
                                 modal: true,
                                 fixed: true,
                                 buttons: [
                                     {
                                         text: RED._("common.label.close"),
                                         click: function() {
                                             notification.close();
                                         }
                                     },{
                                         text: RED._("eventLog.view"),
                                         click: function() {
                                             notification.close();
                                             RED.actions.invoke("core:show-event-log");
                                         }
                                     }
                                 ]
                             });
                         }
                     }
                     done(xhr);
                });
                notification.close();
            }
        });

        var notification = RED.notify(RED._("palette.editor.confirm.install.body",{module:entry.id}),{
            modal: true,
            fixed: true,
            buttons: buttons
        })
    }

    return {
        init: init,
        install: install
    }
})();
