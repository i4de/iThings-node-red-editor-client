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

/**
 * @namespace RED.editor
 */
RED.editor = (function() {

    var editStack = [];
    var buildingEditDialog = false;
    var editing_node = null;
    var editing_config_node = null;

    var customEditTypes = {};
    var editPanes = {};
    var filteredEditPanes = {};

    var editTrayWidthCache = {};

    /**
     * Validate a node
     * @param node - the node being validated
     * @returns {boolean} whether the node is valid. Sets node.dirty if needed
     */
    function validateNode(node) {
        var oldValue = node.valid;
        var oldChanged = node.changed;
        node.valid = true;
        var subflow;
        var isValid;
        var validationErrors;
        var hasChanged;
        if (node.type.indexOf("subflow:")===0) {
            subflow = RED.nodes.subflow(node.type.substring(8));
            isValid = subflow.valid;
            hasChanged = subflow.changed;
            if (isValid === undefined) {
                isValid = validateNode(subflow);
                hasChanged = subflow.changed;
            }
            validationErrors = validateNodeProperties(node, node._def.defaults, node);
            node.valid = isValid && validationErrors.length === 0;
            node.changed = node.changed || hasChanged;
            node.validationErrors = validationErrors;
        } else if (node._def) {
            validationErrors = validateNodeProperties(node, node._def.defaults, node);
            if (node._def._creds) {
                validationErrors = validationErrors.concat(validateNodeProperties(node, node._def.credentials, node._def._creds))
            }
            node.valid = (validationErrors.length === 0);
            node.validationErrors = validationErrors;
        } else if (node.type == "subflow") {
            var subflowNodes = RED.nodes.filterNodes({z:node.id});
            for (var i=0;i<subflowNodes.length;i++) {
                isValid = subflowNodes[i].valid;
                hasChanged = subflowNodes[i].changed;
                if (isValid === undefined) {
                    isValid = validateNode(subflowNodes[i]);
                    hasChanged = subflowNodes[i].changed;
                }
                node.valid = node.valid && isValid;
                node.changed = node.changed || hasChanged;
            }
            var subflowInstances = RED.nodes.filterNodes({type:"subflow:"+node.id});
            var modifiedTabs = {};
            for (i=0;i<subflowInstances.length;i++) {
                subflowInstances[i].valid = node.valid;
                subflowInstances[i].changed = subflowInstances[i].changed || node.changed;
                subflowInstances[i].dirty = true;
                modifiedTabs[subflowInstances[i].z] = true;
            }
            Object.keys(modifiedTabs).forEach(function(id) {
                var subflow = RED.nodes.subflow(id);
                if (subflow) {
                    validateNode(subflow);
                }
            });
        }
        if (oldValue !== node.valid || oldChanged !== node.changed) {
            node.dirty = true;
            subflow = RED.nodes.subflow(node.z);
            if (subflow) {
                validateNode(subflow);
            }
        }
        return node.valid;
    }

    /**
     * Validate a node's properties for the given set of property definitions
     * @param node - the node being validated
     * @param definition - the node property definitions (either def.defaults or def.creds)
     * @param properties - the node property values to validate
     * @returns {array} an array of invalid properties
     */
    function validateNodeProperties(node, definition, properties) {
        var result = [];
        for (var prop in definition) {
            if (definition.hasOwnProperty(prop)) {
                var valid = validateNodeProperty(node, definition, prop, properties[prop]);
                if ((typeof valid) === "string") {
                    result.push(valid);
                }
                else if(!valid) {
                    result.push(prop);
                }
            }
        }
        return result;
    }

    /**
     * Validate a individual node property
     * @param node - the node being validated
     * @param definition - the node property definitions (either def.defaults or def.creds)
     * @param property - the property name being validated
     * @param value - the property value being validated
     * @returns {boolean|string} whether the node proprty is valid. `true`: valid `false|String`: invalid
     */
    function validateNodeProperty(node,definition,property,value) {
        var valid = true;
        // Check for $(env-var) and consider it valid
        if (/^\$\([a-zA-Z_][a-zA-Z0-9_]*\)$/.test(value)) {
            return true;
        }
        // Check for ${env-var} and consider it valid
        if (/^\$\{[a-zA-Z_][a-zA-Z0-9_]*\}$/.test(value)) {
            return true;
        }
        var label = null;
        if (("label" in definition[property]) &&
            ((typeof definition[property].label) == "string")) {
            label = definition[property].label;
        }
        if ("required" in definition[property] && definition[property].required) {
            valid = value !== "";
            if (!valid && label) {
                return RED._("validator.errors.missing-required-prop", {
                    prop: label
                });
            }
        }
        if (valid && "validate" in definition[property]) {
            try {
                var opt = {};
                if (label) {
                    opt.label = label;
                }
                valid = definition[property].validate.call(node,value, opt);
                // If the validator takes two arguments, it is a 3.x validator that
                // can return a String to mean 'invalid' and provide a reason
                if ((definition[property].validate.length === 2) &&
                    ((typeof valid) === "string")) {
                    return valid;
                } else {
                    // Otherwise, a 2.x returns a truth-like/false-like value that
                    // we should cooerce to a boolean.
                    valid = !!valid
                }
            } catch(err) {
                console.log("Validation error:",node.type,node.id,"property: "+property,"value:",value,err);
                return RED._("validator.errors.validation-error", {
                    prop: property,
                    node: node.type,
                    id: node.id,
                    error: err.message
                });
            }
        }
        if (valid && definition[property].type && RED.nodes.getType(definition[property].type) && !("validate" in definition[property])) {
            if (!value || value == "_ADD_") {
                valid = definition[property].hasOwnProperty("required") && !definition[property].required;
                if (!valid && label) {
                    return RED._("validator.errors.missing-required-prop", {
                        prop: label
                    });
                }
            } else {
                var configNode = RED.nodes.node(value);
                if (configNode) {
                    if ((configNode.valid == null) || configNode.valid) {
                        return true;
                    }
                    if (label) {
                        return RED._("validator.errors.invalid-config", {
                            prop: label
                        });
                    }
                }
                else {
                    if (label) {
                        return RED._("validator.errors.missing-config", {
                            prop: label
                        });
                    }
                }
                return false;
            }
        }
        return valid;
    }

    function validateNodeEditor(node,prefix) {
        for (var prop in node._def.defaults) {
            if (node._def.defaults.hasOwnProperty(prop)) {
                validateNodeEditorProperty(node,node._def.defaults,prop,prefix);
            }
        }
        if (node._def.credentials) {
            for (prop in node._def.credentials) {
                if (node._def.credentials.hasOwnProperty(prop)) {
                    validateNodeEditorProperty(node,node._def.credentials,prop,prefix);
                }
            }
        }
    }

    function validateNodeEditorProperty(node,defaults,property,prefix) {
        var input = $("#"+prefix+"-"+property);
        if (input.length > 0) {
            var value = input.val();
            if (defaults[property].hasOwnProperty("format") && defaults[property].format !== "" && input[0].nodeName === "DIV") {
                value = input.text();
            }
            var valid = validateNodeProperty(node, defaults, property,value);
            if (((typeof valid) === "string") || !valid) {
                input.addClass("input-error");
                input.next(".red-ui-typedInput-container").addClass("input-error");
                if ((typeof valid) === "string") {
                    var tooltip = input.data("tooltip");
                    if (tooltip) {
                        tooltip.setContent(valid);
                    }
                    else {
                        tooltip = RED.popover.tooltip(input, valid);
                        input.data("tooltip", tooltip);
                    }
                }
            } else {
                input.removeClass("input-error");
                input.next(".red-ui-typedInput-container").removeClass("input-error");
                var tooltip = input.data("tooltip");
                if (tooltip) {
                    input.data("tooltip", null);
                    tooltip.delete();
                }
            }
        }
    }

    /**
     * Called when the node's properties have changed.
     * Marks the node as dirty and needing a size check.
     * Removes any links to non-existant outputs.
     * @param node - the node that has been updated
     * @param outputMap - (optional) a map of old->new port numbers if wires should be moved
     * @returns {array} the links that were removed due to this update
     */
    function updateNodeProperties(node, outputMap) {
        node.resize = true;
        node.dirty = true;
        node.dirtyStatus = true;
        var removedLinks = [];
        if (outputMap) {
            RED.nodes.eachLink(function(l) {
                if (l.source === node) {
                    if (outputMap.hasOwnProperty(l.sourcePort)) {
                        if (outputMap[l.sourcePort] === "-1") {
                            removedLinks.push(l);
                        } else {
                            l.sourcePort = outputMap[l.sourcePort];
                        }
                    }
                }
            });
        }
        if (node.hasOwnProperty("__outputs")) {
            if (node.outputs < node.__outputs) {
                RED.nodes.eachLink(function(l) {
                    if (l.source === node && l.sourcePort >= node.outputs && removedLinks.indexOf(l) === -1) {
                        removedLinks.push(l);
                    }
                });
            }
            delete node.__outputs;
        }
        node.inputs = Math.min(1,Math.max(0,parseInt(node.inputs)));
        if (isNaN(node.inputs)) {
            node.inputs = 0;
        }
        if (node.inputs === 0) {
            removedLinks = removedLinks.concat(RED.nodes.filterLinks({target:node}));
        }
        for (var l=0;l<removedLinks.length;l++) {
            RED.nodes.removeLink(removedLinks[l]);
        }
        return removedLinks;
    }

    /**
     * Create a config-node select box for this property
     * @param node - the node being edited
     * @param property - the name of the field
     * @param type - the type of the config-node
     */
    function prepareConfigNodeSelect(node,property,type,prefix,filter) {
        var input = $("#"+prefix+"-"+property);
        if (input.length === 0 ) {
            return;
        }
        var newWidth = input.width();
        var attrStyle = input.attr('style');
        var m;
        if ((m = /(^|\s|;)width\s*:\s*([^;]+)/i.exec(attrStyle)) !== null) {
            newWidth = m[2].trim();
        } else {
            newWidth = "70%";
        }
        var outerWrap = $("<div></div>").css({
            width: newWidth,
            display:'inline-flex'
        });
        var select = $('<select id="'+prefix+'-'+property+'"></select>').appendTo(outerWrap);
        input.replaceWith(outerWrap);
        // set the style attr directly - using width() on FF causes a value of 114%...
        select.css({
            'flex-grow': 1
        });
        updateConfigNodeSelect(property,type,node[property],prefix,filter);
        $('<a id="'+prefix+'-lookup-'+property+'" class="red-ui-button"><i class="fa fa-pencil"></i></a>')
            .css({"margin-left":"10px"})
            .appendTo(outerWrap);
        $('#'+prefix+'-lookup-'+property).on("click", function(e) {
            showEditConfigNodeDialog(property,type,select.find(":selected").val(),prefix,node);
            e.preventDefault();
        });
        var label = "";
        var configNode = RED.nodes.node(node[property]);
        var node_def = RED.nodes.getType(type);

        if (configNode) {
            label = RED.utils.getNodeLabel(configNode,configNode.id);
        }
        input.val(label);
    }

    /**
     * Create a config-node button for this property
     * @param node - the node being edited
     * @param property - the name of the field
     * @param type - the type of the config-node
     */
    function prepareConfigNodeButton(node,property,type,prefix) {
        var input = $("#"+prefix+"-"+property);
        input.val(node[property]);
        input.attr("type","hidden");

        var button = $("<a>",{id:prefix+"-edit-"+property, class:"red-ui-button"});
        input.after(button);

        if (node[property]) {
            button.text(RED._("editor.configEdit"));
        } else {
            button.text(RED._("editor.configAdd"));
        }

        button.on("click", function(e) {
            showEditConfigNodeDialog(property,type,input.val()||"_ADD_",prefix,node);
            e.preventDefault();
        });
    }

    /**
     * Populate the editor dialog input field for this property
     * @param node - the node being edited
     * @param property - the name of the field
     * @param prefix - the prefix to use in the input element ids (node-input|node-config-input)
     * @param definition - the definition of the field
     */
    function preparePropertyEditor(node,property,prefix,definition) {
        var input = $("#"+prefix+"-"+property);
        if (input.length === 0) {
            return;
        }
        if (input.attr('type') === "checkbox") {
            input.prop('checked',node[property]);
        }
        else {
            var val = node[property];
            if (val == null) {
                val = "";
            }
            if (definition !== undefined && definition[property].hasOwnProperty("format") && definition[property].format !== "" && input[0].nodeName === "DIV") {
                input.html(RED.text.format.getHtml(val, definition[property].format, {}, false, "en"));
                RED.text.format.attach(input[0], definition[property].format, {}, false, "en");
            } else {
                input.val(val);
                if (input[0].nodeName === 'INPUT' || input[0].nodeName === 'TEXTAREA') {
                    RED.text.bidi.prepareInput(input);
                }
            }
        }
    }

    /**
     * Add an on-change handler to revalidate a node field
     * @param node - the node being edited
     * @param definition - the definition of the node
     * @param property - the name of the field
     * @param prefix - the prefix to use in the input element ids (node-input|node-config-input)
     */
    function attachPropertyChangeHandler(node,definition,property,prefix) {
        $("#"+prefix+"-"+property).on("change keyup paste", function(event) {
            if (!$(this).attr("skipValidation")) {
                validateNodeEditor(node,prefix);
            }
        });
    }

    /**
     * Assign the value to each credential field
     * @param node
     * @param credDef
     * @param credData
     * @param prefix
     */
    function populateCredentialsInputs(node, credDef, credData, prefix) {
        var cred;
        for (cred in credDef) {
            if (credDef.hasOwnProperty(cred)) {
                if (credDef[cred].type == 'password') {
                    if (credData[cred]) {
                        $('#' + prefix + '-' + cred).val(credData[cred]);
                    } else if (credData['has_' + cred]) {
                        $('#' + prefix + '-' + cred).val('__PWRD__');
                    }
                    else {
                        $('#' + prefix + '-' + cred).val('');
                    }
                } else {
                    preparePropertyEditor(credData, cred, prefix, credDef);
                }
                attachPropertyChangeHandler(node, credDef, cred, prefix);
            }
        }
    }

    /**
     * Prepare all of the editor dialog fields
     * @param trayBody - the tray body to populate
     * @param nodeEditPanes - array of edit pane ids to add to the dialog
     * @param node - the node being edited
     * @param definition - the node definition
     * @param prefix - the prefix to use in the input element ids (node-input|node-config-input)
     * @param default - the id of the tab to show by default
     */
    function prepareEditDialog(trayBody, nodeEditPanes, node, definition, prefix, defaultTab, done) {
        var finishedBuilding = false;
        var completePrepare = function() {

            var editorTabEl = $('<ul></ul>').appendTo(trayBody);
            var editorContent = $('<div></div>').appendTo(trayBody);

            var editorTabs = RED.tabs.create({
                element:editorTabEl,
                onchange:function(tab) {
                    editorContent.children().hide();
                    tab.content.show();
                    if (tab.onchange) {
                        tab.onchange.call(tab);
                    }
                    if (finishedBuilding) {
                        RED.tray.resize();
                    }
                },
                collapsible: true,
                menu: false
            });

            var activeEditPanes = [];

            nodeEditPanes = nodeEditPanes.slice();
            for (var i in filteredEditPanes) {
                if (filteredEditPanes.hasOwnProperty(i)) {
                    if (filteredEditPanes[i](node)) {
                        nodeEditPanes.push(i);
                    }
                }
            }

            nodeEditPanes.forEach(function(id) {
                try {
                    var editPaneDefinition = editPanes[id];
                    if (editPaneDefinition) {
                        if (typeof editPaneDefinition === 'function') {
                            editPaneDefinition = editPaneDefinition.call(editPaneDefinition, node);
                        }
                        var editPaneContent = $('<div>', {class:"red-ui-tray-content"}).appendTo(editorContent).hide();
                        editPaneDefinition.create.call(editPaneDefinition,editPaneContent);
                        var editTab = {
                            id: id,
                            label: editPaneDefinition.label,
                            name: editPaneDefinition.name,
                            iconClass: editPaneDefinition.iconClass,
                            content: editPaneContent,
                            onchange: function() {
                                if (editPaneDefinition.show) {
                                    editPaneDefinition.show.call(editPaneDefinition)
                                }
                            }
                        }
                        editorTabs.addTab(editTab);
                        activeEditPanes.push(editPaneDefinition);
                    } else {
                        console.warn("Unregisted edit pane:",id)
                    }
                } catch(err) {
                    console.log(id,err);
                }
            });

            for (var d in definition.defaults) {
                if (definition.defaults.hasOwnProperty(d)) {
                    if (definition.defaults[d].type) {
                        if (!definition.defaults[d]._type.array) {
                            var configTypeDef = RED.nodes.getType(definition.defaults[d].type);
                            if (configTypeDef && configTypeDef.category === 'config') {
                                if (configTypeDef.exclusive) {
                                    prepareConfigNodeButton(node,d,definition.defaults[d].type,prefix);
                                } else {
                                    prepareConfigNodeSelect(node,d,definition.defaults[d].type,prefix,definition.defaults[d].filter);
                                }
                            } else {
                                console.log("Unknown type:", definition.defaults[d].type);
                                preparePropertyEditor(node,d,prefix,definition.defaults);
                            }
                        }
                    } else {
                        preparePropertyEditor(node,d,prefix,definition.defaults);
                    }
                    attachPropertyChangeHandler(node,definition.defaults,d,prefix);
                }
            }

            if (!/^subflow:/.test(definition.type)) {
                populateCredentialsInputs(node, definition.credentials, node.credentials, prefix);
            }

            if (definition.oneditprepare) {
                try {
                    definition.oneditprepare.call(node);
                } catch(err) {
                    console.log("oneditprepare",node.id,node.type,err.toString());
                    console.log(err.stack);
                }
            }

            // Now invoke any change handlers added to the fields - passing true
            // to prevent full node validation from being triggered each time
            for (var d in definition.defaults) {
                if (definition.defaults.hasOwnProperty(d)) {
                    var el = $("#"+prefix+"-"+d);
                    el.attr("skipValidation", true);
                    if (el.data("noderedTypedInput") !== undefined) {
                        el.trigger("change",[el.typedInput('type'),el.typedInput('value')]);
                    } else {
                        el.trigger("change");
                    }
                    el.removeAttr("skipValidation");
                }
            }
            if (definition.credentials) {
                for (d in definition.credentials) {
                    if (definition.credentials.hasOwnProperty(d)) {
                        var el = $("#"+prefix+"-"+d);
                        el.attr("skipValidation", true);
                        if (el.data("noderedTypedInput") !== undefined) {
                            el.trigger("change",[el.typedInput('type'),el.typedInput('value')]);
                        } else {
                            el.trigger("change");
                        }
                        el.removeAttr("skipValidation");
                    }
                }
            }
            validateNodeEditor(node,prefix);
            finishedBuilding = true;
            if (defaultTab) {
                editorTabs.activateTab(defaultTab);
            }
            if (done) {
                done(activeEditPanes);
            }
        }
        if (definition.credentials || /^subflow:/.test(definition.type) || node.type === "group" || node.type === "tab") {
            if (node.credentials) {
                populateCredentialsInputs(node, definition.credentials, node.credentials, prefix);
                completePrepare();
            } else {
                var nodeType = node.type;
                if  (/^subflow:/.test(nodeType)) {
                    nodeType = "subflow"
                }
                getNodeCredentials(nodeType, node.id, function(data) {
                    if (data) {
                        node.credentials = data;
                        node.credentials._ = $.extend(true,{},data);
                    }
                    completePrepare();
                });
            }
        } else {
            completePrepare();
        }
    }

    function getEditStackTitle() {
        var label;
        for (var i=editStack.length-1;i<editStack.length;i++) {
            var node = editStack[i];
            label = node.type;
            if (node.type === 'group') {
                label = RED._("group.editGroup",{name:RED.utils.sanitize(node.name||node.id)});
            } else if (node.type === '_expression') {
                label = RED._("expressionEditor.title");
            } else if (node.type === '_js') {
                label = RED._("jsEditor.title");
            } else if (node.type === '_text') {
                label = RED._("textEditor.title");
            } else if (node.type === '_json') {
                label = RED._("jsonEditor.title");
            } else if (node.type === '_markdown') {
                label = RED._("markdownEditor.title");
            } else if (node.type === '_buffer') {
                label = RED._("bufferEditor.title");
            } else if (node.type === 'subflow') {
                label = RED._("subflow.editSubflow",{name:RED.utils.sanitize(node.name)})
            } else if (node.type.indexOf("subflow:")===0) {
                var subflow = RED.nodes.subflow(node.type.substring(8));
                label = RED._("subflow.editSubflowInstance",{name:RED.utils.sanitize(subflow.name)})
            } else if (node._def !== undefined) {
                if (typeof node._def.paletteLabel !== "undefined") {
                    try {
                        label = RED.utils.sanitize((typeof node._def.paletteLabel === "function" ? node._def.paletteLabel.call(node._def) : node._def.paletteLabel)||"");
                    } catch(err) {
                        console.log("Definition error: "+node.type+".paletteLabel",err);
                    }
                }
                if (i === editStack.length-1) {
                    if (RED.nodes.node(node.id)) {
                        label = RED._("editor.editNode",{type:RED.utils.sanitize(label)});
                    } else {
                        label = RED._("editor.addNewConfig",{type:RED.utils.sanitize(label)});
                    }
                }
            }
        }
        return label;
    }

    function isSameObj(env0, env1) {
        return (JSON.stringify(env0) === JSON.stringify(env1));
    }

    function buildEditForm(container,formId,type,ns,node) {
        var dialogForm = $('<form id="'+formId+'" class="form-horizontal" autocomplete="off"></form>').appendTo(container);
        dialogForm.html($("script[data-template-name='"+type+"']").html());
        ns = ns||"node-red";
        dialogForm.find('[data-i18n]').each(function() {
            var current = $(this).attr("data-i18n");
            var keys = current.split(";");
            for (var i=0;i<keys.length;i++) {
                var key = keys[i];
                if (key.indexOf(":") === -1) {
                    var prefix = "";
                    if (key.indexOf("[")===0) {
                        var parts = key.split("]");
                        prefix = parts[0]+"]";
                        key = parts[1];
                    }
                    keys[i] = prefix+ns+":"+key;
                }
            }
            $(this).attr("data-i18n",keys.join(";"));
        });

        // Add dummy fields to prevent 'Enter' submitting the form in some
        // cases, and also prevent browser auto-fill of password
        //  - the elements cannot be hidden otherwise Chrome will ignore them.
        //  - the elements need to have id's that imply password/username
        $('<span style="position: absolute; top: -2000px;"><input id="red-ui-trap-password" type="password"/></span>').prependTo(dialogForm);
        $('<span style="position: absolute; top: -2000px;"><input id="red-ui-trap-username"  type="text"/></span>').prependTo(dialogForm);
        $('<span style="position: absolute; top: -2000px;"><input id="red-ui-trap-user"  type="text"/></span>').prependTo(dialogForm);
        dialogForm.on("submit", function(e) { e.preventDefault();});
        dialogForm.find('input').attr("autocomplete","off");
        return dialogForm;
    }

    function handleEditSave(editing_node, editState) {
        var d;
        if (editing_node._def.oneditsave) {
            var oldValues = {};
            for (d in editing_node._def.defaults) {
                if (editing_node._def.defaults.hasOwnProperty(d)) {
                    if (typeof editing_node[d] === "string" || typeof editing_node[d] === "number") {
                        oldValues[d] = editing_node[d];
                    } else {
                        oldValues[d] = $.extend(true,{},{v:editing_node[d]}).v;
                    }
                }
            }

            try {
                var rc = editing_node._def.oneditsave.call(editing_node);
                if (rc === true) {
                    editState.changed = true;
                }
            } catch(err) {
                console.warn("oneditsave",editing_node.id,editing_node.type,err.toString());
            }

            for (d in editing_node._def.defaults) {
                if (editing_node._def.defaults.hasOwnProperty(d)) {
                    if (oldValues[d] === null || typeof oldValues[d] === "string" || typeof oldValues[d] === "number") {
                        if (oldValues[d] !== editing_node[d]) {
                            editState.changes[d] = oldValues[d];
                            editState.changed = true;
                        }
                    } else if (editing_node.type !== 'group' || d !== "nodes") {
                        if (JSON.stringify(oldValues[d]) !== JSON.stringify(editing_node[d])) {
                            editState.changes[d] = oldValues[d];
                            editState.changed = true;
                        }
                    }
                }
            }
        }
    }

    function defaultConfigNodeSort(A,B) {
        if (A.__label__ < B.__label__) {
            return -1;
        } else if (A.__label__ > B.__label__) {
            return 1;
        }
        return 0;
    }

    function updateConfigNodeSelect(name,type,value,prefix,filter) {
        // if prefix is null, there is no config select to update
        if (prefix) {
            var button = $("#"+prefix+"-edit-"+name);
            if (button.length) {
                if (value) {
                    button.text(RED._("editor.configEdit"));
                } else {
                    button.text(RED._("editor.configAdd"));
                }
                $("#"+prefix+"-"+name).val(value);
            } else {

                var select = $("#"+prefix+"-"+name);
                var node_def = RED.nodes.getType(type);
                select.children().remove();

                var activeWorkspace = RED.nodes.workspace(RED.workspaces.active());
                if (!activeWorkspace) {
                    activeWorkspace = RED.nodes.subflow(RED.workspaces.active());
                }

                var configNodes = [];
                if (typeof filter !== 'function') {
                    filter = null;
                }
                RED.nodes.eachConfig(function(config) {
                    if (config.type == type && (!config.z || config.z === activeWorkspace.id)) {
                        if (!filter || filter.call(null,config)) {
                            var label = RED.utils.getNodeLabel(config,config.id);
                            config.__label__ = label+(config.d?" ["+RED._("workspace.disabled")+"]":"");
                            configNodes.push(config);
                        }
                    }
                });
                var configSortFn = defaultConfigNodeSort;
                if (typeof node_def.sort == "function") {
                    configSortFn = node_def.sort;
                }
                try {
                    configNodes.sort(configSortFn);
                } catch(err) {
                    console.log("Definition error: "+node_def.type+".sort",err);
                }

                configNodes.forEach(function(cn) {
                    $('<option value="'+cn.id+'"'+(value==cn.id?" selected":"")+'></option>').text(RED.text.bidi.enforceTextDirectionWithUCC(cn.__label__)).appendTo(select);
                    delete cn.__label__;
                });

                var label = type;
                if (typeof node_def.paletteLabel !== "undefined") {
                    try {
                        label = RED.utils.sanitize((typeof node_def.paletteLabel === "function" ? node_def.paletteLabel.call(node_def) : node_def.paletteLabel)||type);
                    } catch(err) {
                        console.log("Definition error: "+type+".paletteLabel",err);
                    }
                }

                select.append('<option value="_ADD_"'+(value===""?" selected":"")+'>'+RED._("editor.addNewType", {type:label})+'</option>');
                window.setTimeout(function() { select.trigger("change");},50);
            }
        }
    }

    function getNodeCredentials(type, id, done) {
        var timeoutNotification;
        var intialTimeout = setTimeout(function() {
            timeoutNotification = RED.notify($('<p data-i18n="[prepend]editor.loadCredentials">  <img src="' + RED.resource.url("images/spin.svg") + '"/></p>').i18n(),{fixed: true})
        },800);

        var dashedType = type.replace(/\s+/g, '-');
        var credentialsUrl = 'credentials/' + dashedType + "/" + id;

        $.ajax({
            url: credentialsUrl,
            dataType: 'json',
            success: function(data) {
                if (timeoutNotification) {
                    timeoutNotification.close();
                    timeoutNotification = null;
                }
                clearTimeout(intialTimeout);
                done(data);
            },
            error: function(jqXHR,status,error) {
                if (timeoutNotification) {
                    timeoutNotification.close();
                    timeoutNotification = null;
                }
                clearTimeout(intialTimeout);
                RED.notify(RED._("editor.errors.credentialLoadFailed"),"error")
                done(null);
            },
            timeout: 30000,
        });
    }

    function showEditDialog(node, defaultTab) {
        if (buildingEditDialog) { return }
        buildingEditDialog = true;
        var editing_node = node;
        var removeInfoEditorOnClose = false;
        var skipInfoRefreshOnClose = false;
        var activeEditPanes = [];

        editStack.push(node);
        RED.view.state(RED.state.EDITING);
        var type = node.type;
        if (node.type.substring(0,8) == "subflow:") {
            type = "subflow";
        }

        var trayOptions = {
            title: getEditStackTitle(),
            buttons: [
                {
                    id: "node-dialog-delete",
                    class: 'leftButton',
                    text: RED._("common.label.delete"),
                    click: function() {
                        var startDirty = RED.nodes.dirty();
                        var removedNodes = [];
                        var removedLinks = [];
                        var removedEntities = RED.nodes.remove(editing_node.id);
                        removedNodes.push(editing_node);
                        removedNodes = removedNodes.concat(removedEntities.nodes);
                        removedLinks = removedLinks.concat(removedEntities.links);

                        var historyEvent = {
                            t:'delete',
                            nodes:removedNodes,
                            links:removedLinks,
                            changes: {},
                            dirty: startDirty
                        }

                        RED.nodes.dirty(true);
                        RED.view.redraw(true);
                        RED.history.push(historyEvent);
                        RED.tray.close();
                    }
                },
                {
                    id: "node-dialog-cancel",
                    text: RED._("common.label.cancel"),
                    click: function() {
                        if (editing_node._def) {
                            if (editing_node._def.oneditcancel) {
                                try {
                                    editing_node._def.oneditcancel.call(editing_node);
                                } catch(err) {
                                    console.log("oneditcancel",editing_node.id,editing_node.type,err.toString());
                                }
                            }

                            for (var d in editing_node._def.defaults) {
                                if (editing_node._def.defaults.hasOwnProperty(d)) {
                                    var def = editing_node._def.defaults[d];
                                    if (def.type) {
                                        var configTypeDef = RED.nodes.getType(def.type);
                                        if (configTypeDef && configTypeDef.exclusive) {
                                            var input = $("#node-input-"+d).val()||"";
                                            if (input !== "" && !editing_node[d]) {
                                                // This node has an exclusive config node that
                                                // has just been added. As the user is cancelling
                                                // the edit, need to delete the just-added config
                                                // node so that it doesn't get orphaned.
                                                RED.nodes.remove(input);
                                            }
                                        }
                                    }
                                }

                            }
                        }
                        RED.tray.close();
                    }
                },
                {
                    id: "node-dialog-ok",
                    text: RED._("common.label.done"),
                    class: "primary",
                    click: function() {
                        var editState = {
                            changes: {},
                            changed: false,
                            outputMap: null
                        }
                        var wasDirty = RED.nodes.dirty();

                        handleEditSave(editing_node,editState)

                        activeEditPanes.forEach(function(pane) {
                            if (pane.apply) {
                                pane.apply.call(pane, editState);
                            }
                        })

                        var removedLinks = updateNodeProperties(editing_node, editState.outputMap);

                        if ($("#node-input-node-disabled").prop('checked')) {
                            if (node.d !== true) {
                                editState.changes.d = node.d;
                                editState.changed = true;
                                node.d = true;
                            }
                        } else {
                            if (node.d === true) {
                                editState.changes.d = node.d;
                                editState.changed = true;
                                delete node.d;
                            }
                        }

                        node.resize = true;

                        if (editState.changed) {
                            var wasChanged = editing_node.changed;
                            editing_node.changed = true;
                            RED.nodes.dirty(true);

                            var activeSubflow = RED.nodes.subflow(RED.workspaces.active());
                            var subflowInstances = null;
                            if (activeSubflow) {
                                subflowInstances = [];
                                RED.nodes.eachNode(function(n) {
                                    if (n.type == "subflow:"+RED.workspaces.active()) {
                                        subflowInstances.push({
                                            id:n.id,
                                            changed:n.changed
                                        });
                                        n.changed = true;
                                        n.dirty = true;
                                        updateNodeProperties(n);
                                    }
                                });
                            }
                            var historyEvent = {
                                t:'edit',
                                node:editing_node,
                                changes:editState.changes,
                                links:removedLinks,
                                dirty:wasDirty,
                                changed:wasChanged
                            };
                            if (editState.outputMap) {
                                historyEvent.outputMap = editState.outputMap;
                            }
                            if (subflowInstances) {
                                historyEvent.subflow = {
                                    instances:subflowInstances
                                }
                            }
                            RED.history.push(historyEvent);
                        }
                        editing_node.dirty = true;
                        validateNode(editing_node);
                        RED.events.emit("editor:save",editing_node);
                        RED.events.emit("nodes:change",editing_node);
                        RED.tray.close();
                    }
                }
            ],
            resize: function(dimensions) {
                editTrayWidthCache[type] = dimensions.width;
                $(".red-ui-tray-content").height(dimensions.height - 50);
                var form = $(".red-ui-tray-content form").height(dimensions.height - 50 - 40);
                var size = {width:form.width(),height:form.height()};
                activeEditPanes.forEach(function(pane) {
                    if (pane.resize) {
                        pane.resize.call(pane, size);
                    }
                })
            },
            open: function(tray, done) {
                if (editing_node.hasOwnProperty('outputs')) {
                    editing_node.__outputs = editing_node.outputs;
                }

                var trayFooter = tray.find(".red-ui-tray-footer");
                var trayBody = tray.find('.red-ui-tray-body');
                trayBody.parent().css('overflow','hidden');

                var trayFooterLeft = $('<div class="red-ui-tray-footer-left"></div>').appendTo(trayFooter)

                $('<input id="node-input-node-disabled" type="checkbox">').prop("checked",!!node.d).appendTo(trayFooterLeft).toggleButton({
                    enabledIcon: "fa-circle-thin",
                    disabledIcon: "fa-ban",
                    invertState: true
                })

                var nodeEditPanes = ['editor-tab-properties'];
                if (/^subflow:/.test(node.type)) {
                    nodeEditPanes.push("editor-tab-envProperties");
                }
                if (!node._def.defaults || !node._def.defaults.hasOwnProperty('info'))  {
                    nodeEditPanes.push('editor-tab-description');
                    removeInfoEditorOnClose = true;
                    if(node.infoEditor) {
                        //As 'editor-tab-description' adds `node.infoEditor` store original & set a
                        //flag to NOT remove this property
                        node.infoEditor__orig = node.infoEditor;
                        delete node.infoEditor;
                        removeInfoEditorOnClose = false;
                    }
                }
                nodeEditPanes.push("editor-tab-appearance");

                prepareEditDialog(trayBody, nodeEditPanes,node,node._def,"node-input", defaultTab, function(_activeEditPanes) {
                    activeEditPanes = _activeEditPanes;
                    trayBody.i18n();
                    trayFooter.i18n();
                    buildingEditDialog = false;
                    done();
                });
            },
            close: function() {
                if (RED.view.state() != RED.state.IMPORT_DRAGGING) {
                    RED.view.state(RED.state.DEFAULT);
                }
                if (editing_node) {
                    if (editing_node.infoEditor__orig) {
                        editing_node.infoEditor = editing_node.infoEditor__orig;
                        delete editing_node.infoEditor__orig;
                    }
                    if (removeInfoEditorOnClose) {
                        delete editing_node.infoEditor;
                    }
                    if (!skipInfoRefreshOnClose) {
                        RED.sidebar.info.refresh(editing_node);
                    }
                }
                RED.workspaces.refresh();

                activeEditPanes.forEach(function(pane) {
                    if (pane.close) {
                        pane.close.call(pane);
                    }
                })

                RED.view.redraw(true);
                editStack.pop();
            },
            show: function() {
                if (editing_node) {
                    RED.sidebar.info.refresh(editing_node);
                    RED.sidebar.help.show(editing_node.type, false);
                    //ensure focused element is NOT body (for keyboard scope to operate correctly)
                    if (document.activeElement.tagName === 'BODY') {
                        $('#red-ui-editor-stack').trigger('focus')
                    }
                }
            }
        }
        if (editTrayWidthCache.hasOwnProperty(type)) {
            trayOptions.width = editTrayWidthCache[type];
        }

        if (type === 'subflow') {
            var id = editing_node.type.substring(8);
            trayOptions.buttons.unshift({
                class: 'leftButton',
                text: RED._("subflow.edit"),
                click: function() {
                    RED.workspaces.show(id);
                    skipInfoRefreshOnClose = true;
                    $("#node-dialog-ok").trigger("click");
                }
            });
        }

        RED.tray.show(trayOptions);
    }
    /**
     * name - name of the property that holds this config node
     * type - type of config node
     * id - id of config node to edit. _ADD_ for a new one
     * prefix - the input prefix of the parent property
     * editContext - the node that was being edited that triggered editing this node
     */
    function showEditConfigNodeDialog(name,type,id,prefix,editContext) {
        if (buildingEditDialog) { return }
        buildingEditDialog = true;
        var adding = (id == "_ADD_");
        var node_def = RED.nodes.getType(type);
        var editing_config_node = RED.nodes.node(id);
        var activeEditPanes = [];

        var configNodeScope = ""; // default to global
        var activeSubflow = RED.nodes.subflow(RED.workspaces.active());
        if (activeSubflow) {
            configNodeScope = activeSubflow.id;
        }
        if (editing_config_node == null) {
            editing_config_node = {
                id: RED.nodes.id(),
                _def: node_def,
                type: type,
                z: configNodeScope,
                users: []
            }
            for (var d in node_def.defaults) {
                if (node_def.defaults[d].value) {
                    editing_config_node[d] = JSON.parse(JSON.stringify(node_def.defaults[d].value));
                }
            }
            editing_config_node["_"] = node_def._;
        }
        editStack.push(editing_config_node);

        RED.view.state(RED.state.EDITING);
        var trayOptions = {
            title: getEditStackTitle(), //(adding?RED._("editor.addNewConfig", {type:type}):RED._("editor.editConfig", {type:type})),
            resize: function(dimensions) {
                $(".red-ui-tray-content").height(dimensions.height - 50);
                var form = $("#node-config-dialog-edit-form");
                var size = {width:form.width(),height:form.height()};
                activeEditPanes.forEach(function(pane) {
                    if (pane.resize) {
                        pane.resize.call(pane, size);
                    }
                })
            },
            open: function(tray, done) {
                var trayHeader = tray.find(".red-ui-tray-header");
                var trayBody = tray.find('.red-ui-tray-body');
                var trayFooter = tray.find(".red-ui-tray-footer");

                var trayFooterLeft = $('<div class="red-ui-tray-footer-left"></div>').appendTo(trayFooter)

                $('<input id="node-config-input-node-disabled" type="checkbox">').prop("checked",!!editing_config_node.d).appendTo(trayFooterLeft).toggleButton({
                    enabledIcon: "fa-circle-thin",
                    disabledIcon: "fa-ban",
                    invertState: true
                })

                if (node_def.hasUsers !== false) {
                    $('<span><i class="fa fa-info-circle"></i> <span id="red-ui-editor-config-user-count"></span></span>').css("margin-left", "10px").appendTo(trayFooterLeft);
                }
                trayFooter.append('<span class="red-ui-tray-footer-right"><span id="red-ui-editor-config-scope-warning" data-i18n="[title]editor.errors.scopeChange"><i class="fa fa-warning"></i></span><select id="red-ui-editor-config-scope"></select></span>');


                var nodeEditPanes = [ 'editor-tab-properties' ];
                if (!editing_config_node._def.defaults || !editing_config_node._def.defaults.hasOwnProperty('info'))  {
                    nodeEditPanes.push('editor-tab-description');
                }

                prepareEditDialog(trayBody, nodeEditPanes, editing_config_node, node_def, "node-config-input", null, function(_activeEditPanes) {
                    activeEditPanes = _activeEditPanes;
                    if (editing_config_node._def.exclusive) {
                        $("#red-ui-editor-config-scope").hide();
                    } else {
                        $("#red-ui-editor-config-scope").show();
                    }
                    $("#red-ui-editor-config-scope-warning").hide();

                    var nodeUserFlows = {};
                    editing_config_node.users.forEach(function(n) {
                        nodeUserFlows[n.z] = true;
                    });
                    var flowCount = Object.keys(nodeUserFlows).length;
                    var tabSelect = $("#red-ui-editor-config-scope").empty();
                    tabSelect.off("change");
                    tabSelect.append('<option value=""'+(!editing_config_node.z?" selected":"")+' data-i18n="sidebar.config.global"></option>');
                    tabSelect.append('<option disabled data-i18n="sidebar.config.flows"></option>');
                    RED.nodes.eachWorkspace(function(ws) {
                        var workspaceLabel = ws.label;
                        if (nodeUserFlows[ws.id]) {
                            workspaceLabel = "* "+workspaceLabel;
                        }
                        $('<option value="'+ws.id+'"'+(ws.id==editing_config_node.z?" selected":"")+'></option>').text(workspaceLabel).appendTo(tabSelect);
                    });
                    tabSelect.append('<option disabled data-i18n="sidebar.config.subflows"></option>');
                    RED.nodes.eachSubflow(function(ws) {
                        var workspaceLabel = ws.name;
                        if (nodeUserFlows[ws.id]) {
                            workspaceLabel = "* "+workspaceLabel;
                        }
                        $('<option value="'+ws.id+'"'+(ws.id==editing_config_node.z?" selected":"")+'></option>').text(workspaceLabel).appendTo(tabSelect);
                    });
                    if (flowCount > 0) {
                        tabSelect.on('change',function() {
                            var newScope = $(this).val();
                            if (newScope === '') {
                                // global scope - everyone can use it
                                $("#red-ui-editor-config-scope-warning").hide();
                            } else if (!nodeUserFlows[newScope] || flowCount > 1) {
                                // a user will loose access to it
                                $("#red-ui-editor-config-scope-warning").show();
                            } else {
                                $("#red-ui-editor-config-scope-warning").hide();
                            }
                        });
                    }
                    if (node_def.hasUsers !== false) {
                        $("#red-ui-editor-config-user-count").text(RED._("editor.nodesUse", {count:editing_config_node.users.length})).parent().show();
                    }
                    trayBody.i18n();
                    trayFooter.i18n();
                    buildingEditDialog = false;
                    done();
                });
            },
            close: function() {
                RED.workspaces.refresh();

                activeEditPanes.forEach(function(pane) {
                    if (pane.close) {
                        pane.close.call(pane);
                    }
                })

                editStack.pop();
            },
            show: function() {
                if (editing_config_node) {
                    RED.sidebar.info.refresh(editing_config_node);
                    RED.sidebar.help.show(type, false);
                }
            }
        }
        trayOptions.buttons = [
            {
                id: "node-config-dialog-cancel",
                text: RED._("common.label.cancel"),
                click: function() {
                    var configType = type;
                    var configId = editing_config_node.id;
                    var configAdding = adding;
                    var configTypeDef = RED.nodes.getType(configType);
                    if (configTypeDef.oneditcancel) {
                        // TODO: what to pass as this to call
                        if (configTypeDef.oneditcancel) {
                            var cn = RED.nodes.node(configId);
                            if (cn) {
                                try {
                                    configTypeDef.oneditcancel.call(cn,false);
                                } catch(err) {
                                    console.log("oneditcancel",cn.id,cn.type,err.toString());
                                }
                            } else {
                                try {
                                    configTypeDef.oneditcancel.call({id:configId},true);
                                } catch(err) {
                                    console.log("oneditcancel",configId,configType,err.toString());
                                }
                            }
                        }
                    }
                    RED.tray.close();
                }
            },
            {
                id: "node-config-dialog-ok",
                text: adding?RED._("editor.configAdd"):RED._("editor.configUpdate"),
                class: "primary",
                click: function() {
                    var editState = {
                        changes: {},
                        changed: false,
                        outputMap: null
                    };
                    var configProperty = name;
                    var configId = editing_config_node.id;
                    var configType = type;
                    var configAdding = adding;
                    var configTypeDef = RED.nodes.getType(configType);
                    var d;
                    var input;

                    if (configTypeDef.oneditsave) {
                        try {
                            configTypeDef.oneditsave.call(editing_config_node);
                        } catch(err) {
                            console.warn("oneditsave",editing_config_node.id,editing_config_node.type,err.toString());
                        }
                    }

                    for (d in configTypeDef.defaults) {
                        if (configTypeDef.defaults.hasOwnProperty(d)) {
                            var newValue;
                            input = $("#node-config-input-"+d);
                            if (input.attr('type') === "checkbox") {
                                newValue = input.prop('checked');
                            } else if ("format" in configTypeDef.defaults[d] && configTypeDef.defaults[d].format !== "" && input[0].nodeName === "DIV") {
                                newValue = input.text();
                            } else {
                                newValue = input.val();
                            }
                            if (newValue != null && newValue !== editing_config_node[d]) {
                                if (editing_config_node._def.defaults[d].type) {
                                    if (newValue == "_ADD_") {
                                        newValue = "";
                                    }
                                    // Change to a related config node
                                    var configNode = RED.nodes.node(editing_config_node[d]);
                                    if (configNode) {
                                        var users = configNode.users;
                                        users.splice(users.indexOf(editing_config_node),1);
                                        RED.events.emit("nodes:change",configNode);
                                    }
                                    configNode = RED.nodes.node(newValue);
                                    if (configNode) {
                                        configNode.users.push(editing_config_node);
                                        RED.events.emit("nodes:change",configNode);
                                    }
                                }
                                editing_config_node[d] = newValue;
                            }
                        }
                    }

                    activeEditPanes.forEach(function(pane) {
                        if (pane.apply) {
                            pane.apply.call(pane, editState);
                        }
                    })

                    editing_config_node.label = configTypeDef.label;

                    var scope = $("#red-ui-editor-config-scope").val();
                    editing_config_node.z = scope;

                    if ($("#node-config-input-node-disabled").prop('checked')) {
                        if (editing_config_node.d !== true) {
                            editing_config_node.d = true;
                        }
                    } else {
                        if (editing_config_node.d === true) {
                            delete editing_config_node.d;
                        }
                    }

                    if (scope) {
                        // Search for nodes that use this one that are no longer
                        // in scope, so must be removed
                        editing_config_node.users = editing_config_node.users.filter(function(n) {
                            var keep = true;
                            for (var d in n._def.defaults) {
                                if (n._def.defaults.hasOwnProperty(d)) {
                                    if (n._def.defaults[d].type === editing_config_node.type &&
                                        n[d] === editing_config_node.id &&
                                        n.z !== scope) {
                                            keep = false;
                                            // Remove the reference to this node
                                            // and revalidate
                                            n[d] = null;
                                            n.dirty = true;
                                            n.changed = true;
                                            validateNode(n);
                                    }
                                }
                            }
                            return keep;
                        });
                    }

                    if (configAdding) {
                        RED.nodes.add(editing_config_node);
                    }

                    validateNode(editing_config_node);
                    var validatedNodes = {};
                    validatedNodes[editing_config_node.id] = true;

                    var userStack = editing_config_node.users.slice();
                    while(userStack.length > 0) {
                        var user = userStack.pop();
                        if (!validatedNodes[user.id]) {
                            validatedNodes[user.id] = true;
                            if (user.users) {
                                userStack = userStack.concat(user.users);
                            }
                            validateNode(user);
                        }
                    }
                    RED.nodes.dirty(true);
                    RED.view.redraw(true);
                    if (!configAdding) {
                        RED.events.emit("editor:save",editing_config_node);
                        RED.events.emit("nodes:change",editing_config_node);
                    }
                    RED.tray.close(function() {
                        var filter = null;
                        if (editContext && typeof editContext._def.defaults[configProperty].filter === 'function') {
                            filter = function(n) {
                                return editContext._def.defaults[configProperty].filter.call(editContext,n);
                            }
                        }
                        updateConfigNodeSelect(configProperty,configType,editing_config_node.id,prefix,filter);
                    });
                }
            }
        ];

        if (!adding) {
            trayOptions.buttons.unshift({
                class: 'leftButton',
                text: RED._("editor.configDelete"), //'<i class="fa fa-trash"></i>',
                click: function() {
                    var configProperty = name;
                    var configId = editing_config_node.id;
                    var configType = type;
                    var configTypeDef = RED.nodes.getType(configType);

                    try {

                        if (configTypeDef.ondelete) {
                            // Deprecated: never documented but used by some early nodes
                            console.log("Deprecated API warning: config node type ",configType," has an ondelete function - should be oneditdelete");
                            configTypeDef.ondelete.call(editing_config_node);
                        }
                        if (configTypeDef.oneditdelete) {
                            configTypeDef.oneditdelete.call(editing_config_node);
                        }
                    } catch(err) {
                        console.log("oneditdelete",editing_config_node.id,editing_config_node.type,err.toString());
                    }

                    var historyEvent = {
                        t:'delete',
                        nodes:[editing_config_node],
                        changes: {},
                        dirty: RED.nodes.dirty()
                    }
                    for (var i=0;i<editing_config_node.users.length;i++) {
                        var user = editing_config_node.users[i];
                        historyEvent.changes[user.id] = {
                            changed: user.changed,
                            valid: user.valid
                        };
                        for (var d in user._def.defaults) {
                            if (user._def.defaults.hasOwnProperty(d) && user[d] == configId) {
                                historyEvent.changes[user.id][d] = configId
                                user[d] = "";
                                user.changed = true;
                                user.dirty = true;
                            }
                        }
                        validateNode(user);
                    }
                    RED.nodes.remove(configId);
                    RED.nodes.dirty(true);
                    RED.view.redraw(true);
                    RED.history.push(historyEvent);
                    RED.tray.close(function() {
                        var filter = null;
                        if (editContext && typeof editContext._def.defaults[configProperty].filter === 'function') {
                            filter = function(n) {
                                return editContext._def.defaults[configProperty].filter.call(editContext,n);
                            }
                        }
                        updateConfigNodeSelect(configProperty,configType,"",prefix,filter);
                    });
                }
            });
        }

        RED.tray.show(trayOptions);
    }

    function showEditSubflowDialog(subflow, defaultTab) {
        if (buildingEditDialog) { return }
        buildingEditDialog = true;
        var editing_node = subflow;
        var activeEditPanes = [];
        editStack.push(subflow);
        RED.view.state(RED.state.EDITING);
        var trayOptions = {
            title: getEditStackTitle(),
            buttons: [
                {
                    id: "node-dialog-cancel",
                    text: RED._("common.label.cancel"),
                    click: function() {
                        RED.tray.close();
                    }
                },
                {
                    id: "node-dialog-ok",
                    class: "primary",
                    text: RED._("common.label.done"),
                    click: function() {
                        var i;
                        var editState = {
                            changes: {},
                            changed: false,
                            outputMap: null
                        }
                        var wasDirty = RED.nodes.dirty();

                        activeEditPanes.forEach(function(pane) {
                            if (pane.apply) {
                                pane.apply.call(pane, editState);
                            }
                        })

                        var newName = $("#subflow-input-name").val();

                        if (newName != editing_node.name) {
                            editState.changes['name'] = editing_node.name;
                            editing_node.name = newName;
                            editState.changed = true;
                        }


                        var old_env = editing_node.env;
                        var new_env = RED.subflow.exportSubflowTemplateEnv($("#node-input-env-container").editableList("items"));

                        if (new_env && new_env.length > 0) {
                            new_env.forEach(function(prop) {
                                if (prop.type === "cred") {
                                    editing_node.credentials = editing_node.credentials || {_:{}};
                                    editing_node.credentials[prop.name] = prop.value;
                                    editing_node.credentials['has_'+prop.name] = (prop.value !== "");
                                    if (prop.value !== '__PWRD__') {
                                        editState.changed = true;
                                    }
                                    delete prop.value;
                                }
                            });
                        }

                        if (!isSameObj(old_env, new_env)) {
                            editing_node.env = new_env;
                            editState.changes.env = editing_node.env;
                            editState.changed = true;
                        }



                        if (editState.changed) {
                            var wasChanged = editing_node.changed;
                            editing_node.changed = true;
                            validateNode(editing_node);
                            var subflowInstances = [];
                            RED.nodes.eachNode(function(n) {
                                if (n.type == "subflow:"+editing_node.id) {
                                    subflowInstances.push({
                                        id:n.id,
                                        changed:n.changed
                                    })
                                    n._def.color = editing_node.color;
                                    n.changed = true;
                                    n.dirty = true;
                                    updateNodeProperties(n);
                                    validateNode(n);
                                }
                            });
                            RED.events.emit("subflows:change",editing_node);
                            RED.nodes.dirty(true);
                            var historyEvent = {
                                t:'edit',
                                node:editing_node,
                                changes:editState.changes,
                                dirty:wasDirty,
                                changed:wasChanged,
                                subflow: {
                                    instances:subflowInstances
                                }
                            };

                            RED.history.push(historyEvent);
                        }
                        editing_node.dirty = true;
                        RED.tray.close();
                    }
                }
            ],
            resize: function(dimensions) {
                $(".red-ui-tray-content").height(dimensions.height - 50);

                var form = $(".red-ui-tray-content form").height(dimensions.height - 50 - 40);
                var size = {width:form.width(),height:form.height()};
                activeEditPanes.forEach(function(pane) {
                    if (pane.resize) {
                        pane.resize.call(pane, size);
                    }
                })
            },
            open: function(tray, done) {
                var trayFooter = tray.find(".red-ui-tray-footer");
                var trayFooterLeft = $("<div/>", {
                    class: "red-ui-tray-footer-left"
                }).appendTo(trayFooter)
                var trayBody = tray.find('.red-ui-tray-body');
                trayBody.parent().css('overflow','hidden');

                $('<span style="margin-left: 10px"><i class="fa fa-info-circle"></i> <i id="red-ui-editor-subflow-user-count"></i></span>').appendTo(trayFooterLeft);

                if (editing_node) {
                    RED.sidebar.info.refresh(editing_node);
                }

                var nodeEditPanes = [
                    'editor-tab-properties',
                    'editor-tab-subflow-module',
                    'editor-tab-description',
                    'editor-tab-appearance'
                ];

                prepareEditDialog(trayBody, nodeEditPanes, subflow, subflow._def, "node-input", defaultTab, function(_activeEditPanes) {
                    activeEditPanes = _activeEditPanes;
                    $("#subflow-input-name").val(subflow.name);
                    RED.text.bidi.prepareInput($("#subflow-input-name"));
                    trayBody.i18n();
                    trayFooter.i18n();
                    buildingEditDialog = false;
                    done();
                });
            },
            close: function() {
                if (RED.view.state() != RED.state.IMPORT_DRAGGING) {
                    RED.view.state(RED.state.DEFAULT);
                }
                RED.sidebar.info.refresh(editing_node);
                RED.workspaces.refresh();
                activeEditPanes.forEach(function(pane) {
                    if (pane.close) {
                        pane.close.call(pane);
                    }
                })
                editStack.pop();
                editing_node = null;
            },
            show: function() {
            }
        }
        RED.tray.show(trayOptions);
    }

    function showEditGroupDialog(group, defaultTab) {
        if (buildingEditDialog) { return }
        buildingEditDialog = true;
        var editing_node = group;
        editStack.push(group);
        RED.view.state(RED.state.EDITING);
        var activeEditPanes = [];

        var trayOptions = {
            title: getEditStackTitle(),
            buttons: [
                {
                    id: "node-dialog-cancel",
                    text: RED._("common.label.cancel"),
                    click: function() {
                        RED.tray.close();
                    }
                },
                {
                    id: "node-dialog-ok",
                    class: "primary",
                    text: RED._("common.label.done"),
                    click: function() {
                        var editState = {
                            changes: {},
                            changed: false,
                            outputMap: null
                        }
                        var wasDirty = RED.nodes.dirty();

                        handleEditSave(editing_node,editState);

                        activeEditPanes.forEach(function(pane) {
                            if (pane.apply) {
                                pane.apply.call(pane, editState);
                            }
                        })

                        if (editState.changed) {
                            var wasChanged = editing_node.changed;
                            editing_node.changed = true;
                            RED.nodes.dirty(true);
                            var historyEvent = {
                                t:'edit',
                                node:editing_node,
                                changes:editState.changes,
                                dirty:wasDirty,
                                changed:wasChanged
                            };
                            RED.history.push(historyEvent);
                            RED.events.emit("groups:change",editing_node);
                        }
                        editing_node.dirty = true;
                        RED.tray.close();
                        RED.view.redraw(true);
                    }
                }
            ],
            resize: function(dimensions) {
                editTrayWidthCache['group'] = dimensions.width;
                $(".red-ui-tray-content").height(dimensions.height - 50);
                var form = $(".red-ui-tray-content form").height(dimensions.height - 50 - 40);
                var size = {width:form.width(),height:form.height()};
                activeEditPanes.forEach(function(pane) {
                    if (pane.resize) {
                        pane.resize.call(pane, size);
                    }
                })
            },
            open: function(tray, done) {
                var trayFooter = tray.find(".red-ui-tray-footer");
                var trayFooterLeft = $("<div/>", {
                    class: "red-ui-tray-footer-left"
                }).appendTo(trayFooter)
                var trayBody = tray.find('.red-ui-tray-body');
                trayBody.parent().css('overflow','hidden');

                var nodeEditPanes = [
                    'editor-tab-properties',
                    'editor-tab-envProperties',
                    'editor-tab-description'
                ];
                prepareEditDialog(trayBody, nodeEditPanes, group,group._def,"node-input", defaultTab, function(_activeEditPanes) {
                    activeEditPanes = _activeEditPanes;
                    trayBody.i18n();
                    buildingEditDialog = false;
                    done();
                });

            },
            close: function() {
                if (RED.view.state() != RED.state.IMPORT_DRAGGING) {
                    RED.view.state(RED.state.DEFAULT);
                }
                RED.sidebar.info.refresh(editing_node);
                activeEditPanes.forEach(function(pane) {
                    if (pane.close) {
                        pane.close.call(pane);
                    }
                })
                editStack.pop();
                editing_node = null;
            },
            show: function() {
            }
        }

        if (editTrayWidthCache.hasOwnProperty('group')) {
            trayOptions.width = editTrayWidthCache['group'];
        }
        RED.tray.show(trayOptions);
    }

    function showEditFlowDialog(workspace, defaultTab) {
        if (buildingEditDialog) { return }
        buildingEditDialog = true;
        var activeEditPanes = [];
        RED.view.state(RED.state.EDITING);
        var trayOptions = {
            title: RED._("workspace.editFlow",{name:RED.utils.sanitize(workspace.label)}),
            buttons: [
                {
                    id: "node-dialog-delete",
                    class: 'leftButton'+((RED.workspaces.count() === 1)?" disabled":""),
                    text: RED._("common.label.delete"), //'<i class="fa fa-trash"></i>',
                    click: function() {
                        RED.workspaces.delete(workspace);
                        RED.tray.close();
                    }
                },
                {
                    id: "node-dialog-cancel",
                    text: RED._("common.label.cancel"),
                    click: function() {
                        RED.tray.close();
                    }
                },
                {
                    id: "node-dialog-ok",
                    class: "primary",
                    text: RED._("common.label.done"),
                    click: function() {
                        var editState = {
                            changes: {},
                            changed: false,
                            outputMap: null
                        }
                        var wasDirty = RED.nodes.dirty();

                        activeEditPanes.forEach(function(pane) {
                            if (pane.apply) {
                                pane.apply.call(pane, editState);
                            }
                        })

                        var disabled = $("#node-input-disabled").prop("checked");
                        if (workspace.disabled !== disabled) {
                            editState.changes.disabled = workspace.disabled;
                            editState.changed = true;
                            workspace.disabled = disabled;

                            $("#red-ui-tab-"+(workspace.id.replace(".","-"))).toggleClass('red-ui-workspace-disabled',!!workspace.disabled);
                            if (workspace.id === RED.workspaces.active()) {
                                $("#red-ui-workspace").toggleClass("red-ui-workspace-disabled",!!workspace.disabled);
                            }
                        }

                        if (editState.changed) {
                            var historyEvent = {
                                t: "edit",
                                changes: editState.changes,
                                node: workspace,
                                dirty: wasDirty
                            }
                            workspace.changed = true;
                            RED.history.push(historyEvent);
                            RED.nodes.dirty(true);
                            if (editState.changes.hasOwnProperty('disabled')) {
                                RED.nodes.eachNode(function(n) {
                                    if (n.z === workspace.id) {
                                        n.dirty = true;
                                    }
                                });
                                RED.view.redraw();
                            }
                            RED.workspaces.refresh();
                            RED.events.emit("flows:change",workspace);
                        }
                        RED.tray.close();
                    }
                }
            ],
            resize: function(dimensions) {
                $(".red-ui-tray-content").height(dimensions.height - 50);
                var form = $(".red-ui-tray-content form").height(dimensions.height - 50 - 40);
                var size = {width:form.width(),height:form.height()};
                activeEditPanes.forEach(function(pane) {
                    if (pane.resize) {
                        pane.resize.call(pane, size);
                    }
                })
            },
            open: function(tray, done) {
                var trayFooter = tray.find(".red-ui-tray-footer");
                var trayBody = tray.find('.red-ui-tray-body');
                trayBody.parent().css('overflow','hidden');
                var trayFooterLeft = $('<div class="red-ui-tray-footer-left"></div>').appendTo(trayFooter)

                var nodeEditPanes = [
                    'editor-tab-flow-properties',
                    'editor-tab-envProperties'
                ];

                if (!workspace.hasOwnProperty("disabled")) {
                    workspace.disabled = false;
                }
                $('<input id="node-input-disabled" type="checkbox">').prop("checked",workspace.disabled).appendTo(trayFooterLeft).toggleButton({
                    enabledIcon: "fa-circle-thin",
                    disabledIcon: "fa-ban",
                    invertState: true
                })
                prepareEditDialog(trayBody, nodeEditPanes, workspace, {}, "node-input", defaultTab, function(_activeEditPanes) {
                    activeEditPanes = _activeEditPanes;
                    trayBody.i18n();
                    trayFooter.i18n();
                    buildingEditDialog = false;
                    done();
                });
            },
            close: function() {
                if (RED.view.state() != RED.state.IMPORT_DRAGGING) {
                    RED.view.state(RED.state.DEFAULT);
                }
                activeEditPanes.forEach(function(pane) {
                    if (pane.close) {
                        pane.close.call(pane);
                    }
                })
                var selection = RED.view.selection();
                if (!selection.nodes && !selection.links && workspace.id === RED.workspaces.active()) {
                    RED.sidebar.info.refresh(workspace);
                }
            }
        }
        RED.tray.show(trayOptions);
    }

    function showTypeEditor(type, options) {
        if (customEditTypes.hasOwnProperty(type)) {
            if (editStack.length > 0) {
                options.parent = editStack[editStack.length-1].id;
            }
            editStack.push({type:type});
            options.title = options.title || getEditStackTitle();
            options.onclose = function() {
                editStack.pop();
            }
            customEditTypes[type].show(options);
        } else {
            console.log("Unknown type editor:",type);
        }
    }

    /** Genrate a consistent but unique ID for saving and restoring the code editors view state */
    function generateViewStateId(source, thing, suffix) {
        try {
            thing = thing || {};
            const thingOptions = typeof thing.options === "object" ? thing.options : {};
            let stateId;
            if (thing.hasOwnProperty("stateId")) {
                stateId = thing.stateId
            } else if (thingOptions.hasOwnProperty("stateId")) {
                stateId = thing.stateId
            }
            if (stateId === false) { return false; }
            if (!stateId) {
                let id;
                const selection = RED.view.selection();
                if (source === "node" && thing.id) {
                    id = thing.id;
                } else if (selection.nodes && selection.nodes.length) {
                    id = selection.nodes[0].id;
                } else {
                    return false; //cant obtain Id.
                }
                //Use a string builder to build an ID
                const sb = [id];
                //get the index of the el - there may be more than one editor.
                const el = $(thing.element || thingOptions.element);
                if(el.length) {
                    sb.push(el.closest(".form-row").index());
                    sb.push(el.index());
                }
                if (source == "typedInput") {
                    sb.push(el.closest("li").index());//for when embeded in editable list
                    if (!suffix && thing.propertyType) { suffix = thing.propertyType }
                }
                stateId = sb.join("/");
            }
            if (stateId && suffix) { stateId += "/" + suffix; }
            return stateId;
        } catch (error) {
            return false;
        }
    }
    return {
        init: function() {
            if(window.ace) { window.ace.config.set('basePath', 'vendor/ace'); }
            RED.tray.init();
            RED.actions.add("core:confirm-edit-tray", function() {
                $(document.activeElement).blur();
                $("#node-dialog-ok").trigger("click");
                $("#node-config-dialog-ok").trigger("click");
            });
            RED.actions.add("core:cancel-edit-tray", function() {
                $(document.activeElement).blur();
                $("#node-dialog-cancel").trigger("click");
                $("#node-config-dialog-cancel").trigger("click");
            });
            RED.editor.codeEditor.init();
        },
        generateViewStateId: generateViewStateId,
        edit: showEditDialog,
        editConfig: showEditConfigNodeDialog,
        editFlow: showEditFlowDialog,
        editSubflow: showEditSubflowDialog,
        editGroup: showEditGroupDialog,
        editJavaScript: function(options) { showTypeEditor("_js",options) },
        editExpression: function(options) { showTypeEditor("_expression", options) },
        editJSON: function(options) { showTypeEditor("_json", options) },
        editMarkdown: function(options) { showTypeEditor("_markdown", options) },
        editText: function(options) {
            if (options.mode == "markdown") {
                showTypeEditor("_markdown", options)
            } else {
                showTypeEditor("_text", options)
            }
        },
        editBuffer: function(options) { showTypeEditor("_buffer", options) },
        buildEditForm: buildEditForm,
        validateNode: validateNode,
        updateNodeProperties: updateNodeProperties,

        showIconPicker: function() { RED.editor.iconPicker.show.apply(null,arguments); },

        /**
         * Show a type editor.
         * @param {string} type - the type to display
         * @param {object} options - options for the editor
         * @function
         * @memberof RED.editor
         */
        showTypeEditor: showTypeEditor,

        /**
         * Register a type editor.
         * @param {string} type - the type name
         * @param {object} definition - the editor definition
         * @function
         * @memberof RED.editor
         */
        registerTypeEditor: function(type, definition) {
            customEditTypes[type] = definition;
        },

        /**
         * Create a editor ui component
         * @param {object} options - the editor options
         * @returs The code editor
         * @memberof RED.editor
         */
        createEditor: function(options) {
            return RED.editor.codeEditor.create(options);
        },
        get customEditTypes() {
            return customEditTypes;
        },

        registerEditPane: function(type, definition, filter) {
            if (filter) {
                filteredEditPanes[type] = filter
            }
            editPanes[type] = definition;
        }
    }
})();
