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
(function($) {
    var contextParse = function(v,defaultStore) {
        var parts = RED.utils.parseContextKey(v, defaultStore&&defaultStore.value);
        return {
            option: parts.store,
            value: parts.key
        }
    }
    var contextExport = function(v,opt) {
        if (!opt) {
            return v;
        }
        var store = ((typeof opt === "string")?opt:opt.value)
        if (store !== RED.settings.context.default) {
            return "#:("+store+")::"+v;
        } else {
            return v;
        }
    }
    var contextLabel =  function(container,value) {
        var that = this;
        container.css("pointer-events","none");
        container.css("flex-grow",0);
        container.css("position",'relative');
        container.css("overflow",'visible');
        $('<div></div>').text(value).css({
            position: "absolute",
            bottom:"-2px",
            right: "5px",
            "font-size": "0.7em",
            opacity: 0.3
        }).appendTo(container);
        this.elementDiv.show();
    }
    var mapDeprecatedIcon = function(icon) {
        if (/^red\/images\/typedInput\/.+\.png$/.test(icon)) {
            icon = icon.replace(/.png$/,".svg");
        }
        return icon;
    }

    var autoComplete = function(options) {
        function getMatch(value, searchValue) {
            const idx = value.toLowerCase().indexOf(searchValue.toLowerCase());
            const len = idx > -1 ? searchValue.length : 0;
            return {
                index: idx,
                found: idx > -1,
                pre: value.substring(0,idx),
                match: value.substring(idx,idx+len),
                post: value.substring(idx+len),
            }
        }
        function generateSpans(match) {
            const els = [];
            if(match.pre) { els.push($('<span/>').text(match.pre)); }
            if(match.match) { els.push($('<span/>',{style:"font-weight: bold; color: var(--red-ui-text-color-link);"}).text(match.match)); }
            if(match.post) { els.push($('<span/>').text(match.post)); }
            return els;
        }
        return function(val) {
            var matches = [];
            options.forEach(opt => {
                const optVal = opt.value;
                const optSrc = (opt.source||[]).join(",");
                const valMatch = getMatch(optVal, val);
                const srcMatch = getMatch(optSrc, val);
                if (valMatch.found || srcMatch.found) {
                    const element = $('<div>',{style: "display: flex"});
                    const valEl = $('<div/>',{style:"font-family: var(--red-ui-monospace-font); white-space:nowrap; overflow: hidden; flex-grow:1"});
                    valEl.append(generateSpans(valMatch));
                    valEl.appendTo(element);
                    if (optSrc) {
                        const optEl = $('<div>').css({ "font-size": "0.8em" });
                        optEl.append(generateSpans(srcMatch));
                        optEl.appendTo(element);
                    }
                    matches.push({
                        value: optVal,
                        label: element,
                        i: (valMatch.found ? valMatch.index : srcMatch.index)
                    });
                }
            })
            matches.sort(function(A,B){return A.i-B.i})
            return matches;
        }
    }

    // This is a hand-generated list of completions for the core nodes (based on the node help html).
    var msgCompletions = [
        { value: "payload" },
        { value: "topic", source: ["mqtt","inject","rbe"] },
        { value: "action", source: ["mqtt"] },
        { value: "complete", source: ["join"] },
        { value: "contentType", source: ["mqtt"] },
        { value: "cookies", source: ["http request","http response"] },
        { value: "correlationData", source: ["mqtt"] },
        { value: "delay", source: ["delay","trigger"] },
        { value: "encoding", source: ["file"] },
        { value: "error", source: ["catch"] },
        { value: "error.message", source: ["catch"] },
        { value: "error.source", source: ["catch"] },
        { value: "error.source.id", source: ["catch"] },
        { value: "error.source.type", source: ["catch"] },
        { value: "error.source.name", source: ["catch"] },
        { value: "filename", source: ["file","file in"] },
        { value: "flush", source: ["delay"] },
        { value: "followRedirects", source: ["http request"] },
        { value: "headers", source: ["http response","http request"] },
        { value: "host", source: ["tcp request","http request"] },
        { value: "ip", source: ["udp out"] },
        { value: "kill", source: ["exec"] },
        { value: "messageExpiryInterval", source: ["mqtt"] },
        { value: "method", source: ["http request"] },
        { value: "options", source: ["xml"] },
        { value: "parts", source: ["split","join","batch","sort"] },
        { value: "pid", source: ["exec"] },
        { value: "port", source: ["tcp request"," udp out"] },
        { value: "qos", source: ["mqtt"] },
        { value: "rate", source: ["delay"] },
        { value: "rejectUnauthorized", source: ["http request"] },
        { value: "req", source: ["http in"]},
        { value: "req.body", source: ["http in"]},
        { value: "req.headers", source: ["http in"]},
        { value: "req.query", source: ["http in"]},
        { value: "req.params", source: ["http in"]},
        { value: "req.cookies", source: ["http in"]},
        { value: "req.files", source: ["http in"]},
        { value: "requestTimeout", source: ["http request"] },
        { value: "reset", source: ["delay","trigger","join","rbe"] },
        { value: "responseCookies", source: ["http request"] },
        { value: "responseTopic", source: ["mqtt"] },
        { value: "responseUrl", source: ["http request"] },
        { value: "restartTimeout", source: ["join"] },
        { value: "retain", source: ["mqtt"] },
        { value: "schema", source: ["json"] },
        { value: "select", source: ["html"] },
        { value: "statusCode", source: ["http response","http request"] },
        { value: "status", source: ["status"] },
        { value: "status.text", source: ["status"] },
        { value: "status.source", source: ["status"] },
        { value: "status.source.type", source: ["status"] },
        { value: "status.source.id", source: ["status"] },
        { value: "status.source.name", source: ["status"] },
        { value: "target", source: ["link call"] },
        { value: "template", source: ["template"] },
        { value: "toFront", source: ["delay"] },
        { value: "url", source: ["http request"] },
        { value: "userProperties", source: ["mqtt"] },
        { value: "_session", source: ["websocket out","tcp out"] },
    ]
    var allOptions = {
        msg: {value:"msg",label:"msg.",validate:RED.utils.validatePropertyExpression, autoComplete: autoComplete(msgCompletions)},
        flow: {value:"flow",label:"flow.",hasValue:true,
            options:[],
            validate:RED.utils.validatePropertyExpression,
            parse: contextParse,
            export: contextExport,
            valueLabel: contextLabel
        },
        global: {value:"global",label:"global.",hasValue:true,
            options:[],
            validate:RED.utils.validatePropertyExpression,
            parse: contextParse,
            export: contextExport,
            valueLabel: contextLabel
        },
        str: {value:"str",label:"string",icon:RED.resource.url("images/typedInput/az.svg")},
        num: {value:"num",label:"number",icon:RED.resource.url("images/typedInput/09.svg"),validate:/^[+-]?[0-9]*\.?[0-9]*([eE][-+]?[0-9]+)?$/},
        bool: {value:"bool",label:"boolean",icon:RED.resource.url("images/typedInput/bool.svg"),options:["true","false"]},
        json: {
            value:"json",
            label:"JSON",
            icon:RED.resource.url("images/typedInput/json.svg"),
            validate: function(v) { try{JSON.parse(v);return true;}catch(e){return false;}},
            expand: function() {
                var that = this;
                var value = this.value();
                try {
                    value = JSON.stringify(JSON.parse(value),null,4);
                } catch(err) {
                }
                RED.editor.editJSON({
                    value: value,
                    stateId: RED.editor.generateViewStateId("typedInput", that, "json"),
                    focus: true,
                    complete: function(v) {
                        var value = v;
                        try {
                            value = JSON.stringify(JSON.parse(v));
                        } catch(err) {
                        }
                        that.value(value);
                    }
                })
            }
        },
        re: {value:"re",label:"regular expression",icon:RED.resource.url("images/typedInput/re.svg")},
        date: {value:"date",label:"timestamp",icon:"fa fa-clock-o",hasValue:false},
        jsonata: {
            value: "jsonata",
            label: "expression",
            icon: RED.resource.url("images/typedInput/expr.svg"),
            validate: function(v) { try{jsonata(v);return true;}catch(e){return false;}},
            expand:function() {
                var that = this;
                RED.editor.editExpression({
                    value: this.value().replace(/\t/g,"\n"),
                    stateId: RED.editor.generateViewStateId("typedInput", that, "jsonata"),
                    focus: true,
                    complete: function(v) {
                        that.value(v.replace(/\n/g,"\t"));
                    }
                })
            }
        },
        bin: {
            value: "bin",
            label: "buffer",
            icon: RED.resource.url("images/typedInput/bin.svg"),
            expand: function() {
                var that = this;
                RED.editor.editBuffer({
                    value: this.value(),
                    stateId: RED.editor.generateViewStateId("typedInput", that, "bin"),
                    focus: true,
                    complete: function(v) {
                        that.value(v);
                    }
                })
            }
        },
        env: {
            value: "env",
            label: "env variable",
            icon: RED.resource.url("images/typedInput/env.svg")
        },
        node: {
            value: "node",
            label: "node",
            icon: RED.resource.url("images/typedInput/target.svg"),
            valueLabel: function(container,value) {
                var node = RED.nodes.node(value);
                var nodeDiv = $('<div>',{class:"red-ui-search-result-node"}).css({
                    "margin-top": "2px",
                    "margin-left": "3px"
                }).appendTo(container);
                var nodeLabel = $('<span>').css({
                    "line-height": "32px",
                    "margin-left": "6px"
                }).appendTo(container);
                if (node) {
                    var colour = RED.utils.getNodeColor(node.type,node._def);
                    var icon_url = RED.utils.getNodeIcon(node._def,node);
                    if (node.type === 'tab') {
                        colour = "#C0DEED";
                    }
                    nodeDiv.css('backgroundColor',colour);
                    var iconContainer = $('<div/>',{class:"red-ui-palette-icon-container"}).appendTo(nodeDiv);
                    RED.utils.createIconElement(icon_url, iconContainer, true);
                    var l = RED.utils.getNodeLabel(node,node.id);
                    nodeLabel.text(l);
                } else {
                    nodeDiv.css({
                        'backgroundColor': '#eee',
                        'border-style' : 'dashed'
                    });

                }
            },
            expand: function() {
                var that = this;
                RED.tray.hide();
                RED.view.selectNodes({
                    single: true,
                    selected: [that.value()],
                    onselect: function(selection) {
                        that.value(selection.id);
                        RED.tray.show();
                    },
                    oncancel: function() {
                        RED.tray.show();
                    }
                })
            }
        },
        cred:{
            value:"cred",
            label:"credential",
            icon:"fa fa-lock",
            inputType: "password",
            valueLabel: function(container,value) {
                var that = this;
                container.css("pointer-events","none");
                container.css("flex-grow",0);
                this.elementDiv.hide();
                var buttons = $('<div>').css({
                    position: "absolute",
                    right:"6px",
                    top: "6px",
                    "pointer-events":"all"
                }).appendTo(container);
                var eyeButton = $('<button type="button" class="red-ui-button red-ui-button-small"></button>').css({
                    width:"20px"
                }).appendTo(buttons).on("click", function(evt) {
                    evt.preventDefault();
                    var cursorPosition = that.input[0].selectionStart;
                    var currentType = that.input.attr("type");
                    if (currentType === "text") {
                        that.input.attr("type","password");
                        eyeCon.removeClass("fa-eye-slash").addClass("fa-eye");
                        setTimeout(function() {
                            that.input.focus();
                            that.input[0].setSelectionRange(cursorPosition, cursorPosition);
                        },50);
                    } else {
                        that.input.attr("type","text");
                        eyeCon.removeClass("fa-eye").addClass("fa-eye-slash");
                        setTimeout(function() {
                            that.input.focus();
                            that.input[0].setSelectionRange(cursorPosition, cursorPosition);
                        },50);
                    }
                }).hide();
                var eyeCon = $('<i class="fa fa-eye"></i>').css("margin-left","-2px").appendTo(eyeButton);

                if (value === "__PWRD__") {
                    var innerContainer = $('<div><i class="fa fa-asterisk"></i><i class="fa fa-asterisk"></i><i class="fa fa-asterisk"></i><i class="fa fa-asterisk"></i><i class="fa fa-asterisk"></i></div>').css({
                        padding:"6px 6px",
                        borderRadius:"4px"
                    }).addClass("red-ui-typedInput-value-label-inactive").appendTo(container);
                    var editButton = $('<button type="button" class="red-ui-button red-ui-button-small"><i class="fa fa-pencil"></i></button>').appendTo(buttons).on("click", function(evt) {
                        evt.preventDefault();
                        innerContainer.hide();
                        container.css("background","none");
                        container.css("pointer-events","none");
                        that.input.val("");
                        that.element.val("");
                        that.elementDiv.show();
                        editButton.hide();
                        cancelButton.show();
                        eyeButton.show();
                        setTimeout(function() {
                            that.input.focus();
                        },50);
                    });
                    var cancelButton = $('<button type="button" class="red-ui-button red-ui-button-small"><i class="fa fa-times"></i></button>').css("margin-left","3px").appendTo(buttons).on("click", function(evt) {
                        evt.preventDefault();
                        innerContainer.show();
                        container.css("background","");
                        that.input.val("__PWRD__");
                        that.element.val("__PWRD__");
                        that.elementDiv.hide();
                        editButton.show();
                        cancelButton.hide();
                        eyeButton.hide();
                        that.input.attr("type","password");
                        eyeCon.removeClass("fa-eye-slash").addClass("fa-eye");

                    }).hide();
                } else {
                    container.css("background","none");
                    container.css("pointer-events","none");
                    this.elementDiv.show();
                    eyeButton.show();
                }
            }
        }
    };

    // For a type with options, check value is a valid selection
    // If !opt.multiple, returns the valid option object
    // if opt.multiple, returns an array of valid option objects
    // If not valid, returns null;

    function isOptionValueValid(opt, currentVal) {
        if (!opt.multiple) {
            for (var i=0;i<opt.options.length;i++) {
                op = opt.options[i];
                if (typeof op === "string" && op === currentVal) {
                    return {value:currentVal}
                } else if (op.value === currentVal) {
                    return op;
                }
            }
        } else {
            // Check to see if value is a valid csv of
            // options.
            var currentValues = {};
            var selected = [];
            currentVal.split(",").forEach(function(v) {
                if (v) {
                    currentValues[v] = true;
                }
            });
            for (var i=0;i<opt.options.length;i++) {
                op = opt.options[i];
                var val = typeof op === "string" ? op : op.value;
                if (currentValues.hasOwnProperty(val)) {
                    delete currentValues[val];
                    selected.push(typeof op === "string" ? {value:op} : op.value)
                }
            }
            if (!$.isEmptyObject(currentValues)) {
                return null;
            }
            return selected
        }
    }

    var nlsd = false;

    $.widget( "nodered.typedInput", {
        _create: function() {
            try {
            if (!nlsd && RED && RED._) {
                for (var i in allOptions) {
                    if (allOptions.hasOwnProperty(i)) {
                        allOptions[i].label = RED._("typedInput.type."+i,{defaultValue:allOptions[i].label});
                    }
                }
                var contextStores = RED.settings.context.stores;
                var contextOptions = contextStores.map(function(store) {
                    return {value:store,label: store, icon:'<i class="red-ui-typedInput-icon fa fa-database"></i>'}
                }).sort(function(A,B) {
                    if (A.value === RED.settings.context.default) {
                        return -1;
                    } else if (B.value === RED.settings.context.default) {
                        return 1;
                    } else {
                        return A.value.localeCompare(B.value);
                    }
                })
                if (contextOptions.length < 2) {
                    allOptions.flow.options = [];
                    allOptions.global.options = [];
                } else {
                    allOptions.flow.options = contextOptions;
                    allOptions.global.options = contextOptions;
                }
            }
            nlsd = true;
            var that = this;
            this.identifier = this.element.attr('id') || "TypedInput-"+Math.floor(Math.random()*100);
            if (this.options.debug) { console.log(this.identifier,"Create",{defaultType:this.options.default, value:this.element.val()}) }
            this.disarmClick = false;
            this.input = $('<input class="red-ui-typedInput-input" type="text"></input>');
            this.input.insertAfter(this.element);
            this.input.val(this.element.val());
            this.element.addClass('red-ui-typedInput');
            this.uiWidth = this.element.outerWidth();
            this.elementDiv = this.input.wrap("<div>").parent().addClass('red-ui-typedInput-input-wrap');
            this.uiSelect = this.elementDiv.wrap( "<div>" ).parent();
            var attrStyle = this.element.attr('style');
            var m;
            if ((m = /width\s*:\s*(calc\s*\(.*\)|\d+(%|px))/i.exec(attrStyle)) !== null) {
                this.input.css('width','100%');
                this.uiSelect.width(m[1]);
                this.uiWidth = null;
            } else if (this.uiWidth !== 0){
                this.uiSelect.width(this.uiWidth);
            }
            ["Right","Left"].forEach(function(d) {
                var m = that.element.css("margin"+d);
                that.uiSelect.css("margin"+d,m);
                that.input.css("margin"+d,0);
            });

            ["type","placeholder","autocomplete","data-i18n"].forEach(function(d) {
                var m = that.element.attr(d);
                that.input.attr(d,m);
            });

            this.defaultInputType = this.input.attr('type');
            // Used to remember selections per-type to restore them when switching between types
            this.oldValues = {};

            this.uiSelect.addClass("red-ui-typedInput-container");

            this.element.attr('type','hidden');

            if (!this.options.types && this.options.type) {
                this.options.types = [this.options.type]
            } else {
                this.options.types = this.options.types||Object.keys(allOptions);
            }

            this.selectTrigger = $('<button type="button" class="red-ui-typedInput-type-select" tabindex="0"></button>').prependTo(this.uiSelect);
            $('<i class="red-ui-typedInput-icon fa fa-caret-down"></i>').toggle(this.options.types.length > 1).appendTo(this.selectTrigger);

            this.selectLabel = $('<span class="red-ui-typedInput-type-label"></span>').appendTo(this.selectTrigger);

            this.valueLabelContainer = $('<div class="red-ui-typedInput-value-label">').appendTo(this.uiSelect)

            this.types(this.options.types);

            if (this.options.typeField) {
                this.typeField = $(this.options.typeField).hide();
                var t = this.typeField.val();
                if (t && this.typeMap[t]) {
                    this.options.default = t;
                }
            } else {
                this.typeField = $("<input>",{type:'hidden'}).appendTo(this.uiSelect);
            }

            this.input.on('focus', function() {
                that.uiSelect.addClass('red-ui-typedInput-focus');
            });
            this.input.on('blur', function() {
                that.uiSelect.removeClass('red-ui-typedInput-focus');
            });
            this.input.on('change', function() {
                that.validate();
                that.element.val(that.value());
                that.element.trigger('change',[that.propertyType,that.value()]);
            });
            this.input.on('keyup', function(evt) {
                that.validate();
                that.element.val(that.value());
                that.element.trigger('keyup',evt);
            });
            this.input.on('paste', function(evt) {
                that.validate();
                that.element.val(that.value());
                that.element.trigger('paste',evt);
            });
            this.input.on('keydown', function(evt) {
                if (that.typeMap[that.propertyType].autoComplete) {
                    return
                }
                if (evt.keyCode >= 37 && evt.keyCode <= 40) {
                    evt.stopPropagation();
                }
            })
            this.selectTrigger.on("click", function(event) {
                event.preventDefault();
                event.stopPropagation();
                that._showTypeMenu();
            });
            this.selectTrigger.on('keydown',function(evt) {
                if (evt.keyCode === 40) {
                    // Down
                    that._showTypeMenu();
                }
                evt.stopPropagation();
            }).on('focus', function() {
                that.uiSelect.addClass('red-ui-typedInput-focus');
            }).on('blur', function() {
                var opt = that.typeMap[that.propertyType];
                if (opt.hasValue === false) {
                    that.uiSelect.removeClass('red-ui-typedInput-focus');
                }
            })

            // explicitly set optionSelectTrigger display to inline-block otherwise jQ sets it to 'inline'
            this.optionSelectTrigger = $('<button type="button" tabindex="0" class="red-ui-typedInput-option-trigger" style="display:inline-block"><span class="red-ui-typedInput-option-caret"><i class="red-ui-typedInput-icon fa fa-caret-down"></i></span></button>').appendTo(this.uiSelect);
            this.optionSelectLabel = $('<span class="red-ui-typedInput-option-label"></span>').prependTo(this.optionSelectTrigger);
            // RED.popover.tooltip(this.optionSelectLabel,function() {
            //     return that.optionValue;
            // });
            this.optionSelectTrigger.on("click", function(event) {
                event.preventDefault();
                event.stopPropagation();
                that._showOptionSelectMenu();
            }).on('keydown', function(evt) {
                if (evt.keyCode === 40) {
                    // Down
                    that._showOptionSelectMenu();
                }
                evt.stopPropagation();
            }).on('blur', function() {
                that.uiSelect.removeClass('red-ui-typedInput-focus');
            }).on('focus', function() {
                that.uiSelect.addClass('red-ui-typedInput-focus');
            });

            this.optionExpandButton = $('<button type="button" tabindex="0" class="red-ui-typedInput-option-expand" style="display:inline-block"></button>').appendTo(this.uiSelect);
            this.optionExpandButtonIcon = $('<i class="red-ui-typedInput-icon fa fa-ellipsis-h"></i>').appendTo(this.optionExpandButton);

            this.type(this.typeField.val() || this.options.default||this.typeList[0].value);
            this.typeChanged = !!this.options.default;
        }catch(err) {
            console.log(err.stack);
        }
        },
        _showTypeMenu: function() {
            if (this.typeList.length > 1) {
                this._showMenu(this.menu,this.selectTrigger);
                var selected = this.menu.find("[value='"+this.propertyType+"']");
                setTimeout(function() {
                    selected.trigger("focus");
                },120);
            } else {
                this.input.trigger("focus");
            }
        },
        _showOptionSelectMenu: function() {
            if (this.optionMenu) {
                this.optionMenu.css({
                    minWidth:this.optionSelectLabel.width()
                });

                this._showMenu(this.optionMenu,this.optionSelectTrigger);
                var targetValue = this.optionValue;
                if (this.optionValue === null || this.optionValue === undefined) {
                    targetValue = this.value();
                }
                var selectedOption = this.optionMenu.find("[value='"+targetValue+"']");
                if (selectedOption.length === 0) {
                    selectedOption = this.optionMenu.children(":first");
                }
                selectedOption.trigger("focus");

            }
        },
        _hideMenu: function(menu) {
            $(document).off("mousedown.red-ui-typedInput-close-property-select");
            menu.hide();
            menu.css({
                height: "auto"
            });

            if (menu.opts.multiple) {
                var selected = [];
                menu.find('input[type="checkbox"]').each(function() {
                    if ($(this).prop("checked")) {
                        selected.push($(this).data('value'))
                    }
                })
                menu.callback(selected);
            }

            if (this.elementDiv.is(":visible")) {
                this.input.trigger("focus");
            } else if (this.optionSelectTrigger.is(":visible")){
                this.optionSelectTrigger.trigger("focus");
            } else {
                this.selectTrigger.trigger("focus");
            }
        },
        _createMenu: function(menuOptions,opts,callback) {
            var that = this;
            var menu = $("<div>").addClass("red-ui-typedInput-options red-ui-editor-dialog");
            menu.opts = opts;
            menu.callback = callback;
            menuOptions.forEach(function(opt) {
                if (typeof opt === 'string') {
                    opt = {value:opt,label:opt};
                }
                var op = $('<a href="#"></a>').attr("value",opt.value).appendTo(menu);
                if (opt.label) {
                    op.text(opt.label);
                }
                if (opt.title) {
                    op.prop('title', opt.title)
                }
                if (opt.icon) {
                    if (opt.icon.indexOf("<") === 0) {
                        $(opt.icon).prependTo(op);
                    } else if (opt.icon.indexOf("/") !== -1) {
                        $('<i>',{class:"red-ui-typedInput-icon", style:"mask-image: url("+opt.icon+"); -webkit-mask-image: url("+opt.icon+");"}).prependTo(op);
                    } else {
                        $('<i>',{class:"red-ui-typedInput-icon "+opt.icon}).prependTo(op);
                    }
                } else {
                    op.css({paddingLeft: "18px"});
                }
                if (!opt.icon && !opt.label) {
                    op.text(opt.value);
                }
                var cb;
                if (opts.multiple) {
                    cb = $('<input type="checkbox">').css("pointer-events","none").data('value',opt.value).prependTo(op).on("mousedown", function(evt) { evt.preventDefault() });
                }

                op.on("click", function(event) {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!opts.multiple) {
                        callback(opt.value);
                        that._hideMenu(menu);
                    } else {
                        cb.prop("checked",!cb.prop("checked"));
                    }
                });
            });
            menu.css({
                display: "none"
            });
            menu.appendTo(document.body);

            menu.on('keydown', function(evt) {
                if (evt.keyCode === 40) {
                    evt.preventDefault();
                    // DOWN
                    $(this).children(":focus").next().trigger("focus");
                } else if (evt.keyCode === 38) {
                    evt.preventDefault();
                    // UP
                    $(this).children(":focus").prev().trigger("focus");
                } else if (evt.keyCode === 27) {
                    // ESCAPE
                    evt.preventDefault();
                    that._hideMenu(menu);
                }
                evt.stopPropagation();
            })
            return menu;

        },
        _showMenu: function(menu,relativeTo) {
            if (this.disarmClick) {
                this.disarmClick = false;
                return
            }
            if (menu.opts.multiple) {
                var selected = {};
                 this.value().split(",").forEach(function(f) {
                     selected[f] = true;
                 })
                menu.find('input[type="checkbox"]').each(function() {
                    $(this).prop("checked",selected[$(this).data('value')])
                })
            }


            var that = this;
            var pos = relativeTo.offset();
            var height = relativeTo.height();
            var menuHeight = menu.height();
            var top = (height+pos.top);
            if (top+menuHeight-$(document).scrollTop() > $(window).height()) {
                top -= (top+menuHeight)-$(window).height()+5;
            }
            if (top < 0) {
                menu.height(menuHeight+top)
                top = 0;
            }
            menu.css({
                top: top+"px",
                left: (pos.left)+"px",
            });
            menu.slideDown(100);
            this._delay(function() {
                that.uiSelect.addClass('red-ui-typedInput-focus');
                $(document).on("mousedown.red-ui-typedInput-close-property-select", function(event) {
                    if(!$(event.target).closest(menu).length) {
                        that._hideMenu(menu);
                    }
                    if ($(event.target).closest(relativeTo).length) {
                        that.disarmClick = true;
                        event.preventDefault();
                    }
                })
            });
        },
        _getLabelWidth: function(label, done) {
            var labelWidth = label.outerWidth();
            if (labelWidth === 0) {
                var wrapper = $('<div class="red-ui-editor"></div>').css({
                    position:"absolute",
                    "white-space": "nowrap",
                    top:-2000
                }).appendTo(document.body);
                var container = $('<div class="red-ui-typedInput-container"></div>').appendTo(wrapper);
                var newTrigger = label.clone().appendTo(container);
                setTimeout(function() {
                    labelWidth = newTrigger.outerWidth();
                    wrapper.remove();
                    done(labelWidth);
                },50)
            } else {
                done(labelWidth);
            }
        },
        _updateOptionSelectLabel: function(o) {
            var opt = this.typeMap[this.propertyType];
            this.optionSelectLabel.empty();
            if (opt.hasValue) {
                this.valueLabelContainer.empty();
                this.valueLabelContainer.show();
            } else {
                this.valueLabelContainer.hide();
            }
            if (this.typeMap[this.propertyType].valueLabel) {
                if (opt.multiple) {
                    this.typeMap[this.propertyType].valueLabel.call(this,opt.hasValue?this.valueLabelContainer:this.optionSelectLabel,o);
                } else {
                    this.typeMap[this.propertyType].valueLabel.call(this,opt.hasValue?this.valueLabelContainer:this.optionSelectLabel,o.value);
                }
            }
            if (!this.typeMap[this.propertyType].valueLabel || opt.hasValue) {
                if (!opt.multiple) {
                    if (o.icon) {
                        if (o.icon.indexOf("<") === 0) {
                            $(o.icon).prependTo(this.optionSelectLabel);
                        } else if (o.icon.indexOf("/") !== -1) {
                            // url
                            $('<img>',{src:mapDeprecatedIcon(o.icon),style:"height: 18px;"}).prependTo(this.optionSelectLabel);
                        } else {
                            // icon class
                            $('<i>',{class:"red-ui-typedInput-icon "+o.icon}).prependTo(this.optionSelectLabel);
                        }
                    } else if (o.label) {
                        this.optionSelectLabel.text(o.label);
                    } else {
                        this.optionSelectLabel.text(o.value);
                    }
                    if (opt.hasValue) {
                        this.optionValue = o.value;
                        this.input.trigger('change',[this.propertyType,this.value()]);
                    }
                } else {
                    this.optionSelectLabel.text(o.length+" selected");
                }
            }
        },
        _destroy: function() {
            if (this.optionMenu) {
                this.optionMenu.remove();
            }
            this.menu.remove();
            this.uiSelect.remove();
        },
        types: function(types) {
            var that = this;
            var currentType = this.type();
            this.typeMap = {};
            var firstCall = (this.typeList === undefined);
            this.typeList = types.map(function(opt) {
                var result;
                if (typeof opt === 'string') {
                    result = allOptions[opt];
                } else {
                    result = opt;
                }
                that.typeMap[result.value] = result;
                return result;
            });
            if (this.typeList.length < 2) {
                this.selectTrigger.attr("tabindex", -1)
                this.selectTrigger.on("mousedown.red-ui-typedInput-focus-block", function(evt) { evt.preventDefault(); })
            } else {
                this.selectTrigger.attr("tabindex", 0)
                this.selectTrigger.off("mousedown.red-ui-typedInput-focus-block")
            }
            this.selectTrigger.toggleClass("disabled", this.typeList.length === 1);
            this.selectTrigger.find(".fa-caret-down").toggle(this.typeList.length > 1)
            if (this.menu) {
                this.menu.remove();
            }
            this.menu = this._createMenu(this.typeList,{},function(v) { that.type(v) });
            if (currentType && !this.typeMap.hasOwnProperty(currentType)) {
                if (!firstCall) {
                    this.type(this.typeList[0].value);
                }
            } else {
                this.propertyType = null;
                if (!firstCall) {
                    this.type(currentType);
                }
            }
            if (this.typeList.length === 1 && !this.typeList[0].icon && (!this.typeList[0].label || this.typeList[0].showLabel === false)) {
                this.selectTrigger.hide()
            } else {
                this.selectTrigger.show()
            }
        },
        width: function(desiredWidth) {
            this.uiWidth = desiredWidth;
            if (this.uiWidth !== null) {
                this.uiSelect.width(this.uiWidth);
            }
        },
        value: function(value) {
            var that = this;
            // If the default type has been set to an invalid type, then on first
            // creation, the current propertyType will not exist. Default to an
            // empty object on the assumption the corrent type will be set shortly
            var opt = this.typeMap[this.propertyType] || {};
            if (!arguments.length) {
                var v = this.input.val();
                if (opt.export) {
                    v = opt.export(v,this.optionValue)
                }
                return v;
            } else {
                if (this.options.debug) { console.log(this.identifier,"----- SET VALUE ------",value) }
                var selectedOption = [];
                var valueToCheck = value;
                if (opt.options) {
                    if (opt.hasValue && opt.parse) {
                        var parts = opt.parse(value);
                        if (this.options.debug) { console.log(this.identifier,"new parse",parts) }
                        value = parts.value;
                        valueToCheck = parts.option || parts.value;
                    }

                    var checkValues = [valueToCheck];
                    if (opt.multiple) {
                        selectedOption = [];
                        checkValues = valueToCheck.split(",");
                    }
                    checkValues.forEach(function(valueToCheck) {
                        for (var i=0;i<opt.options.length;i++) {
                            var op = opt.options[i];
                            if (typeof op === "string") {
                                if (op === valueToCheck || op === ""+valueToCheck) {
                                    selectedOption.push(that.activeOptions[op]);
                                    break;
                                }
                            } else if (op.value === valueToCheck) {
                                selectedOption.push(op);
                                break;
                            }
                        }
                    })
                    if (this.options.debug) { console.log(this.identifier,"set value to",value) }

                    this.input.val(value);
                    if (!opt.multiple) {
                        if (selectedOption.length === 0) {
                            selectedOption = [{value:""}];
                        }
                        this._updateOptionSelectLabel(selectedOption[0])
                    } else {
                        this._updateOptionSelectLabel(selectedOption)
                    }
                } else {
                    this.input.val(value);
                    if (opt.valueLabel) {
                        this.valueLabelContainer.empty();
                        opt.valueLabel.call(this,this.valueLabelContainer,value);
                    }
                }
                this.input.trigger('change',[this.type(),value]);
            }
        },
        type: function(type) {
            if (!arguments.length) {
                return this.propertyType;
            } else {
                var that = this;
                if (this.options.debug) { console.log(this.identifier,"----- SET TYPE -----",type) }
                var previousValue = null;
                var opt = this.typeMap[type];
                if (opt && this.propertyType !== type) {
                    // If previousType is !null, then this is a change of the type, rather than the initialisation
                    var previousType = this.typeMap[this.propertyType];
                    previousValue = this.input.val();

                    if (previousType && this.typeChanged) {
                        if (this.options.debug) { console.log(this.identifier,"typeChanged",{previousType,previousValue}) }
                        if (previousType.options && opt.hasValue !== true) {
                            this.oldValues[previousType.value] = previousValue;
                        } else if (previousType.hasValue === false) {
                            this.oldValues[previousType.value] = previousValue;
                        } else {
                            this.oldValues["_"] = previousValue;
                        }
                        if ((opt.options && opt.hasValue !== true) || opt.hasValue === false) {
                            if (this.oldValues.hasOwnProperty(opt.value)) {
                                if (this.options.debug) { console.log(this.identifier,"restored previous (1)",this.oldValues[opt.value]) }
                                this.input.val(this.oldValues[opt.value]);
                            } else if (opt.options) {
                                // No old value for the option type.
                                // It is possible code has called 'value' then 'type'
                                // to set the selected option. This is what the Inject/Switch/Change
                                // nodes did before 2.1.
                                // So we need to be careful to not reset the value if it is a valid option.
                                var validOptions = isOptionValueValid(opt,previousValue);
                                if (this.options.debug) { console.log(this.identifier,{previousValue,opt,validOptions}) }
                                if ((previousValue || previousValue === '') && validOptions) {
                                    if (this.options.debug) { console.log(this.identifier,"restored previous (2)") }
                                    this.input.val(previousValue);
                                } else {
                                    if (typeof opt.default === "string") {
                                        if (this.options.debug) { console.log(this.identifier,"restored previous (3)",opt.default) }
                                        this.input.val(opt.default);
                                    } else if (Array.isArray(opt.default)) {
                                        if (this.options.debug) { console.log(this.identifier,"restored previous (4)",opt.default.join(",")) }
                                        this.input.val(opt.default.join(","))
                                    } else {
                                        if (this.options.debug) { console.log(this.identifier,"restored previous (5)") }
                                        this.input.val("");
                                    }
                                }
                            } else {
                                if (this.options.debug) { console.log(this.identifier,"restored default/blank",opt.default||"") }
                                this.input.val(opt.default||"")
                            }
                        } else {
                            if (this.options.debug) { console.log(this.identifier,"restored old/default/blank") }
                            this.input.val(this.oldValues.hasOwnProperty("_")?this.oldValues["_"]:(opt.default||""))
                        }
                        if (previousType.autoComplete) {
                            this.input.autoComplete("destroy");
                        }
                    }
                    this.propertyType = type;
                    this.typeChanged = true;
                    if (this.typeField) {
                        this.typeField.val(type);
                    }
                    this.selectLabel.empty();
                    var image;
                    if (opt.icon && opt.showLabel !== false) {
                        if (opt.icon.indexOf("<") === 0) {
                            $(opt.icon).prependTo(this.selectLabel);
                        }
                        else if (opt.icon.indexOf("/") !== -1) {
                            $('<i>',{class:"red-ui-typedInput-icon", style:"mask-image: url("+opt.icon+"); -webkit-mask-image: url("+opt.icon+"); margin-right: 4px;height: 18px;width:13px"}).prependTo(this.selectLabel);
                        }
                        else {
                            $('<i>',{class:"red-ui-typedInput-icon "+opt.icon,style:"min-width: 13px; margin-right: 4px;"}).prependTo(this.selectLabel);
                        }
                    }
                    if (opt.hasValue === false || (opt.showLabel !== false && !opt.icon)) {
                        this.selectLabel.text(opt.label);
                    }
                    if (opt.label) {
                        this.selectTrigger.attr("title",opt.label);
                    } else {
                        this.selectTrigger.attr("title","");
                    }
                    if (opt.hasValue === false) {
                        this.selectTrigger.addClass("red-ui-typedInput-full-width");
                    } else {
                        this.selectTrigger.removeClass("red-ui-typedInput-full-width");
                    }

                    if (this.optionMenu) {
                        this.optionMenu.remove();
                        this.optionMenu = null;
                    }
                    if (opt.options) {
                        if (this.optionExpandButton) {
                            this.optionExpandButton.hide();
                            this.optionExpandButton.shown = false;
                        }
                        if (this.optionSelectTrigger) {
                            this.optionSelectTrigger.css({"display":"inline-flex"});
                            if (!opt.hasValue) {
                                this.optionSelectTrigger.css({"flex-grow":1})
                                this.elementDiv.hide();
                                this.valueLabelContainer.hide();
                            } else {
                                this.optionSelectTrigger.css({"flex-grow":0})
                                this.elementDiv.show();
                                this.valueLabelContainer.hide();
                            }
                            this.activeOptions = {};
                            opt.options.forEach(function(o) {
                                if (typeof o === 'string') {
                                    that.activeOptions[o] = {label:o,value:o};
                                } else {
                                    that.activeOptions[o.value] = o;
                                }
                            });

                            if (!that.activeOptions.hasOwnProperty(that.optionValue)) {
                                that.optionValue = null;
                            }

                            var op;
                            if (!opt.hasValue) {
                                // Check the value is valid for the available options
                                var validValues = isOptionValueValid(opt,this.input.val());
                                if (!opt.multiple) {
                                    if (validValues) {
                                        that._updateOptionSelectLabel(validValues)
                                    } else {
                                        op = opt.options[0];
                                        if (typeof op === "string") {
                                            this.value(op);
                                            that._updateOptionSelectLabel({value:op});
                                        } else {
                                            this.value(op.value);
                                            that._updateOptionSelectLabel(op);
                                        }
                                    }
                                } else {
                                    if (!validValues) {
                                        validValues = (opt.default || []).map(function(v) {
                                            return typeof v === "string"?v:v.value
                                        });
                                        this.value(validValues.join(","));
                                    }
                                    that._updateOptionSelectLabel(validValues);
                                }
                            } else {
                                var selectedOption = this.optionValue||opt.options[0];
                                if (opt.parse) {
                                    var selectedOptionObj = typeof selectedOption === "string"?{value:selectedOption}:selectedOption
                                    var parts = opt.parse(this.input.val(),selectedOptionObj);
                                    if (parts.option) {
                                        selectedOption = parts.option;
                                        if (!this.activeOptions.hasOwnProperty(selectedOption)) {
                                            parts.option = Object.keys(this.activeOptions)[0];
                                            selectedOption = parts.option
                                        }
                                    }
                                    this.input.val(parts.value);
                                    if (opt.export) {
                                        this.element.val(opt.export(parts.value,parts.option||selectedOption));
                                    }
                                }
                                if (typeof selectedOption === "string") {
                                    this.optionValue = selectedOption;
                                    if (!this.activeOptions.hasOwnProperty(selectedOption)) {
                                        selectedOption = Object.keys(this.activeOptions)[0];
                                    }
                                    if (!selectedOption) {
                                        this.optionSelectTrigger.hide();
                                    } else {
                                        this._updateOptionSelectLabel(this.activeOptions[selectedOption]);
                                    }
                                } else if (selectedOption) {
                                    if (this.options.debug) { console.log(this.identifier,"HERE",{optionValue:selectedOption.value}) }
                                    this.optionValue = selectedOption.value;
                                    this._updateOptionSelectLabel(selectedOption);
                                } else {
                                    this.optionSelectTrigger.hide();
                                }
                            }
                            this.optionMenu = this._createMenu(opt.options,opt,function(v){
                                if (!opt.multiple) {
                                    that._updateOptionSelectLabel(that.activeOptions[v]);
                                    if (!opt.hasValue) {
                                        that.value(that.activeOptions[v].value)
                                    }
                                } else {
                                    that._updateOptionSelectLabel(v);
                                    if (!opt.hasValue) {
                                        that.value(v.join(","))
                                    }
                                }
                            });
                        }
                        this._trigger("typechange",null,this.propertyType);
                        this.input.trigger('change',[this.propertyType,this.value()]);
                    } else {
                        if (this.optionSelectTrigger) {
                            this.optionSelectTrigger.hide();
                        }
                        if (opt.inputType) {
                            this.input.attr('type',opt.inputType)
                        } else {
                            this.input.attr('type',this.defaultInputType)
                        }
                        if (opt.hasValue === false) {
                            this.elementDiv.hide();
                            this.valueLabelContainer.hide();
                        } else if (opt.valueLabel) {
                            // Reset any CSS the custom label may have set
                            this.valueLabelContainer.css("pointer-events","");
                            this.valueLabelContainer.css("flex-grow",1);
                            this.valueLabelContainer.css("overflow","hidden");
                            this.valueLabelContainer.show();
                            this.valueLabelContainer.empty();
                            this.elementDiv.hide();
                            opt.valueLabel.call(this,this.valueLabelContainer,this.input.val());
                        } else {
                            this.valueLabelContainer.hide();
                            this.elementDiv.show();
                            if (opt.autoComplete) {
                                this.input.autoComplete({
                                    search: opt.autoComplete,
                                    minLength: 0
                                })
                            }
                        }
                        if (this.optionExpandButton) {
                            if (opt.expand) {
                                if (opt.expand.icon) {
                                    this.optionExpandButtonIcon.removeClass().addClass("red-ui-typedInput-icon fa "+opt.expand.icon)
                                } else {
                                    this.optionExpandButtonIcon.removeClass().addClass("red-ui-typedInput-icon fa fa-ellipsis-h")
                                }
                                this.optionExpandButton.shown = true;
                                this.optionExpandButton.show();
                                this.optionExpandButton.off('click');
                                this.optionExpandButton.on('click',function(evt) {
                                    evt.preventDefault();
                                    if (typeof opt.expand === 'function') {
                                        opt.expand.call(that);
                                    } else {
                                        var container = $('<div>');
                                        var content = opt.expand.content.call(that,container);
                                        var panel = RED.popover.panel(container);
                                        panel.container.css({
                                            width:that.valueLabelContainer.width()
                                        });
                                        if (opt.expand.minWidth) {
                                            panel.container.css({
                                                minWidth: opt.expand.minWidth+"px"
                                            });
                                        }
                                        panel.show({
                                            target:that.optionExpandButton,
                                            onclose:content.onclose,
                                            align: "left"
                                        });
                                    }
                                })
                            } else {
                                this.optionExpandButton.shown = false;
                                this.optionExpandButton.hide();
                            }
                        }
                        this._trigger("typechange",null,this.propertyType);
                        this.input.trigger('change',[this.propertyType,this.value()]);
                    }
                }
            }
        },
        validate: function() {
            var result;
            var value = this.value();
            var type = this.type();
            if (this.typeMap[type] && this.typeMap[type].validate) {
                var val = this.typeMap[type].validate;
                if (typeof val === 'function') {
                    result = val(value);
                } else {
                    result = val.test(value);
                }
            } else {
                result = true;
            }
            if (result) {
                this.uiSelect.removeClass('input-error');
            } else {
                this.uiSelect.addClass('input-error');
            }
            return result;
        },
        show: function() {
            this.uiSelect.show();
        },
        hide: function() {
            this.uiSelect.hide();
        },
        disable: function(val) {
            if(val === undefined || !!val ) {
                this.uiSelect.attr("disabled", "disabled");
            } else {
                this.uiSelect.attr("disabled", null); //remove attr
            }
        },
        enable: function() {
            this.uiSelect.attr("disabled", null); //remove attr
        },
        disabled: function() {
            return this.uiSelect.attr("disabled") === "disabled";
        },
        focus: function() {
            this.input.focus();
        }
    });
})(jQuery);
