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
RED.sidebar = (function() {

    //$('#sidebar').tabs();
    var sidebar_tabs;
    var knownTabs = {};

    // We store the current sidebar tab id in localStorage as 'last-sidebar-tab'
    // This is restored when the editor is reloaded.
    // We use sidebar_tabs.onchange to update localStorage. However that will
    // also get triggered when the first tab gets added to the tabs - typically
    // the 'info' tab. So we use the following variable to store the retrieved
    // value from localStorage before we start adding the actual tabs
    var lastSessionSelectedTab = null;


    function addTab(title,content,closeable,visible) {
        var options;
        if (typeof title === "string") {
            // TODO: legacy support in case anyone uses this...
            options = {
                id: content.id,
                label: title,
                name: title,
                content: content,
                closeable: closeable,
                visible: visible
            }
        } else if (typeof title === "object") {
            options = title;
        }

        delete options.closeable;

        options.wrapper = $('<div>',{style:"height:100%"}).appendTo("#red-ui-sidebar-content")
        options.wrapper.append(options.content);
        options.wrapper.hide();

        if (!options.enableOnEdit) {
            options.shade = $('<div>',{class:"red-ui-sidebar-shade hide"}).appendTo(options.wrapper);
        }

        if (options.toolbar) {
            $("#red-ui-sidebar-footer").append(options.toolbar);
            $(options.toolbar).hide();
        }
        var id = options.id;

        RED.menu.addItem("menu-item-view-menu",{
            id:"menu-item-view-menu-"+options.id,
            label:options.name,
            onselect:function() {
                showSidebar(options.id);
            },
            group: "sidebar-tabs"
        });

        options.iconClass = options.iconClass || "fa fa-square-o"

        knownTabs[options.id] = options;

        if (options.visible !== false) {
            sidebar_tabs.addTab(knownTabs[options.id]);
        }
    }

    function removeTab(id) {
        sidebar_tabs.removeTab(id);
        $(knownTabs[id].wrapper).remove();
        if (knownTabs[id].footer) {
            knownTabs[id].footer.remove();
        }
        delete knownTabs[id];
        RED.menu.removeItem("menu-item-view-menu-"+id);
    }

    var sidebarSeparator =  {};
    sidebarSeparator.dragging = false;

    function setupSidebarSeparator() {
        $("#red-ui-sidebar-separator").draggable({
                axis: "x",
                start:function(event,ui) {
                    sidebarSeparator.closing = false;
                    sidebarSeparator.opening = false;
                    var winWidth = $("#red-ui-editor").width();
                    sidebarSeparator.start = ui.position.left;
                    sidebarSeparator.chartWidth = $("#red-ui-workspace").width();
                    sidebarSeparator.chartRight = winWidth-$("#red-ui-workspace").width()-$("#red-ui-workspace").offset().left-2;
                    sidebarSeparator.dragging = true;

                    if (!RED.menu.isSelected("menu-item-sidebar")) {
                        sidebarSeparator.opening = true;
                        var newChartRight = 7;
                        $("#red-ui-sidebar").addClass("closing");
                        $("#red-ui-workspace").css("right",newChartRight);
                        $("#red-ui-editor-stack").css("right",newChartRight+1);
                        $("#red-ui-sidebar").width(0);
                        RED.menu.setSelected("menu-item-sidebar",true);
                        RED.events.emit("sidebar:resize");
                    }
                    sidebarSeparator.width = $("#red-ui-sidebar").width();
                },
                drag: function(event,ui) {
                    var d = ui.position.left-sidebarSeparator.start;
                    var newSidebarWidth = sidebarSeparator.width-d;
                    if (sidebarSeparator.opening) {
                        newSidebarWidth -= 3;
                    }

                    if (newSidebarWidth > 150) {
                        if (sidebarSeparator.chartWidth+d < 200) {
                            ui.position.left = 200+sidebarSeparator.start-sidebarSeparator.chartWidth;
                            d = ui.position.left-sidebarSeparator.start;
                            newSidebarWidth = sidebarSeparator.width-d;
                        }
                    }

                    if (newSidebarWidth < 150) {
                        if (!sidebarSeparator.closing) {
                            $("#red-ui-sidebar").addClass("closing");
                            sidebarSeparator.closing = true;
                        }
                        if (!sidebarSeparator.opening) {
                            newSidebarWidth = 150;
                            ui.position.left = sidebarSeparator.width-(150 - sidebarSeparator.start);
                            d = ui.position.left-sidebarSeparator.start;
                        }
                    } else if (newSidebarWidth > 150 && (sidebarSeparator.closing || sidebarSeparator.opening)) {
                        sidebarSeparator.closing = false;
                        $("#red-ui-sidebar").removeClass("closing");
                    }

                    var newChartRight = sidebarSeparator.chartRight-d;
                    $("#red-ui-workspace").css("right",newChartRight);
                    $("#red-ui-editor-stack").css("right",newChartRight+1);
                    $("#red-ui-sidebar").width(newSidebarWidth);

                    sidebar_tabs.resize();
                    RED.events.emit("sidebar:resize");
                },
                stop:function(event,ui) {
                    sidebarSeparator.dragging = false;
                    if (sidebarSeparator.closing) {
                        $("#red-ui-sidebar").removeClass("closing");
                        RED.menu.setSelected("menu-item-sidebar",false);
                        if ($("#red-ui-sidebar").width() < 180) {
                            $("#red-ui-sidebar").width(180);
                            $("#red-ui-workspace").css("right",187);
                            $("#red-ui-editor-stack").css("right",188);
                        }
                    }
                    $("#red-ui-sidebar-separator").css("left","auto");
                    $("#red-ui-sidebar-separator").css("right",($("#red-ui-sidebar").width()+2)+"px");
                    RED.events.emit("sidebar:resize");
                }
        });

        var sidebarControls = $('<div class="red-ui-sidebar-control-right"><i class="fa fa-chevron-right"</div>').appendTo($("#red-ui-sidebar-separator"));
        sidebarControls.on("click", function() {
            sidebarControls.hide();
            RED.menu.toggleSelected("menu-item-sidebar");
        })
        $("#red-ui-sidebar-separator").on("mouseenter", function() {
            if (!sidebarSeparator.dragging) {
                if (RED.menu.isSelected("menu-item-sidebar")) {
                    sidebarControls.find("i").addClass("fa-chevron-right").removeClass("fa-chevron-left");
                } else {
                    sidebarControls.find("i").removeClass("fa-chevron-right").addClass("fa-chevron-left");
                }
                sidebarControls.toggle("slide", { direction: "right" }, 200);
            }
        })
        $("#red-ui-sidebar-separator").on("mouseleave", function() {
            if (!sidebarSeparator.dragging) {
                sidebarControls.stop(false,true);
                sidebarControls.hide();
            }
        });
    }

    function toggleSidebar(state) {
        if (!state) {
            $("#red-ui-main-container").addClass("red-ui-sidebar-closed");
        } else {
            $("#red-ui-main-container").removeClass("red-ui-sidebar-closed");
            sidebar_tabs.resize();
        }
        RED.events.emit("sidebar:resize");
    }

    function showSidebar(id, skipShowSidebar) {
        if (id === ":first") {
            id = lastSessionSelectedTab || RED.settings.get("editor.sidebar.order",["info", "help", "version-control", "debug"])[0]
        }
        if (id) {
            if (!containsTab(id) && knownTabs[id]) {
                sidebar_tabs.addTab(knownTabs[id]);
            }
            sidebar_tabs.activateTab(id);
            if (!skipShowSidebar && !RED.menu.isSelected("menu-item-sidebar")) {
                RED.menu.setSelected("menu-item-sidebar",true);
            }
        }
    }

    function containsTab(id) {
        return sidebar_tabs.contains(id);
    }

    function init () {
        setupSidebarSeparator();
        sidebar_tabs = RED.tabs.create({
            element: $('<ul id="red-ui-sidebar-tabs"></ul>').appendTo("#red-ui-sidebar"),
            onchange:function(tab) {
                $("#red-ui-sidebar-content").children().hide();
                $("#red-ui-sidebar-footer").children().hide();
                if (tab.onchange) {
                    tab.onchange.call(tab);
                }
                $(tab.wrapper).show();
                if (tab.toolbar) {
                    $(tab.toolbar).show();
                }
                RED.settings.setLocal("last-sidebar-tab", tab.id)
            },
            onremove: function(tab) {
                $(tab.wrapper).hide();
                if (tab.onremove) {
                    tab.onremove.call(tab);
                }
            },
            // minimumActiveTabWidth: 70,
            collapsible: true,
            onreorder: function(order) {
                RED.settings.set("editor.sidebar.order",order);
            },
            order: RED.settings.get("editor.sidebar.order",["info", "help", "version-control", "debug"])
            // scrollable: true
        });

        $('<div id="red-ui-sidebar-content"></div>').appendTo("#red-ui-sidebar");
        $('<div id="red-ui-sidebar-footer" class="red-ui-component-footer"></div>').appendTo("#red-ui-sidebar");
        $('<div id="red-ui-sidebar-shade" class="hide"></div>').appendTo("#red-ui-sidebar");

        RED.actions.add("core:toggle-sidebar",function(state){
            if (state === undefined) {
                RED.menu.toggleSelected("menu-item-sidebar");
            } else {
                toggleSidebar(state);
            }
        });
        RED.popover.tooltip($("#red-ui-sidebar-separator").find(".red-ui-sidebar-control-right"),RED._("keyboard.toggleSidebar"),"core:toggle-sidebar");

        lastSessionSelectedTab = RED.settings.getLocal("last-sidebar-tab")

        RED.sidebar.info.init();
        RED.sidebar.help.init();
        RED.sidebar.config.init();
        RED.sidebar.context.init();
        // hide info bar at start if screen rather narrow...
        if ($("#red-ui-editor").width() < 600) { RED.menu.setSelected("menu-item-sidebar",false); }
    }

    return {
        init: init,
        addTab: addTab,
        removeTab: removeTab,
        show: showSidebar,
        containsTab: containsTab,
        toggleSidebar: toggleSidebar,
    }

})();
