(function() {
    function indentLine(str,length) {
        if (length <= 0) {
            return str;
        }
        var i = (new Array(length)).join(" ");
        str = str.replace(/^\s*/,i);
        return str;
    }
    function formatExpression(str) {
        var length = str.length;
        var start = 0;
        var inString = false;
        var inRegex = false;
        var inBox = false;
        var quoteChar;
        var list = [];
        var stack = [];
        var frame;
        var v;
        var matchingBrackets = {
            "(":")",
            "[":"]",
            "{":"}"
        }
        for (var i=0;i<length;i++) {
            var c = str[i];
            if (!inString && !inRegex) {
                if (c === "/") {
                    inRegex = true;
                    frame = {type:"regex",pos:i};
                    list.push(frame);
                    stack.push(frame);
                } else if (c === "'" || c === '"') {
                    inString = true;
                    quoteChar = c;
                    frame = {type:"string",pos:i};
                    list.push(frame);
                    stack.push(frame);
                } else if (c === ";") {
                    frame = {type:";",pos:i};
                    list.push(frame);
                } else if (c === ",") {
                    frame = {type:",",pos:i};
                    list.push(frame);
                } else if (c === "&") {
                    frame = {type:"&",pos:i};
                    list.push(frame);
                } else if (/[\(\[\{]/.test(c)) {
                    frame = {type:"open-block",char:c,pos:i};
                    list.push(frame);
                    stack.push(frame);
                } else if (/[\}\)\]]/.test(c)) {
                    var oldFrame = stack.pop();
                    if (matchingBrackets[oldFrame.char] !== c) {
                        // console.log("Stack frame mismatch",c,"at",i,"expected",matchingBrackets[oldFrame.char],"from",oldFrame.pos);
                        // console.log(list);
                        return str;
                    }
                    //console.log("Closing",c,"at",i,"compare",oldFrame.type,oldFrame.pos);
                    oldFrame.width = i-oldFrame.pos;
                    frame = {type:"close-block",pos:i,char:c,width:oldFrame.width}
                    list.push(frame);
                }
            } else {
                if (c === "\\") {
                    // an escaped char - stay in current mode and skip the next char
                    i++;
                }
                if (inString) {
                    if (c === quoteChar) {
                        // Next char must be a ]
                        inString = false;
                        var f = stack.pop();
                        f.end = i;
                    }
                } else if (inRegex) {
                    if (c === "/") {
                        inRegex = false;
                        var f = stack.pop();
                        f.end = i;
                    }
                }
            }
        }
        // console.log("list",list);

        var result = str;
        var indent = 0;
        var offset = 0;
        var pre,post,indented,hasNewline;
        var longStack = [];
        list.forEach(function(f) {
            if (f.type === ";" || f.type === ",") {
                if (longStack[longStack.length-1]) {
                    pre = result.substring(0,offset+f.pos+1);
                    post = result.substring(offset+f.pos+1);
                    indented = indentLine(post,indent);
                    hasNewline = /\n$/.test(pre);
                    // console.log("A??"+pre+"??\n??"+indented+"??",hasNewline);
                    result = pre+(hasNewline?"":"\n")+indented;
                    offset += indented.length-post.length+(hasNewline?0:1);
                }
            } else if (f.type === "&") {
                pre = result.substring(0,offset+f.pos+1);
                var lastLineBreak = pre.lastIndexOf("\n");
                var lineLength = pre.length - lastLineBreak;
                if (lineLength > 70) {
                    post = result.substring(offset+f.pos+1);
                    if (!/^\n/.test(post)) {
                        indented = indentLine(post,indent);
                        hasNewline = /\n$/.test(pre);
                        result = pre+(hasNewline?"":"\n")+indented;
                        offset += indented.length-post.length+(hasNewline?0:1);
                    }
                }

            } else if (f.type === "open-block") {
                if (f.width > 40) {
                    longStack.push(true);
                    indent += 4;
                    pre = result.substring(0,offset+f.pos+1);
                    post = result.substring(offset+f.pos+1);
                    hasNewline = /\n$/.test(pre);
                    indented = indentLine(post,indent);
                    result = pre+(hasNewline?"":"\n")+indented;
                    offset += indented.length-post.length+(hasNewline?0:1);
                } else {
                    longStack.push(false);
                }
            } else if (f.type === "close-block") {
                if (f.width > 40) {
                    indent -= 4;
                    pre = result.substring(0,offset+f.pos);
                    post = result.substring(offset+f.pos);
                    indented = indentLine(post,indent);
                    hasNewline = /\n *$/.test(pre);
                    if (hasNewline) {
                        result = pre + post;
                    } else {
                        result = pre+"\n"+indented;
                        offset += indented.length-post.length+1;
                    }
                }
                longStack.pop();
            }
        })
        //console.log(result);
        return result;
    }

    jsonata.format = formatExpression;
    jsonata.functions =
    {
        '$abs':{ args:[ 'number' ]},
        '$append':{ args:[ 'array1', 'array2' ]},
        '$assert':{ args: [ 'arg', 'str' ]},
        '$average':{ args:[ 'array' ]},
        '$base64decode':{ args:[  ]},
        '$base64encode':{ args:[  ]},
        '$boolean':{ args:[ 'arg' ]},
        '$ceil':{ args:[ 'number' ]},
        '$clone': { args:[ 'arg' ]},
        '$contains':{ args:[ 'str', 'pattern' ]},
        '$count':{ args:[ 'array' ]},
        '$decodeUrl':{ args:[ 'str' ]},
        '$decodeUrlComponent':{ args:[ 'str' ]},
        '$distinct':{ args:[ 'array' ]},
        '$each':{ args:[ 'object', 'function' ]},
        '$encodeUrl':{ args: ['str'] },
        '$encodeUrlComponent':{ args:[ 'str' ]},
        '$env': { args:[ 'arg' ]},
        '$error':{ args:[ 'str' ]},
        '$eval': { args: ['expr', 'context']},
        '$exists':{ args:[ 'arg' ]},
        '$filter':{ args:[ 'array', 'function' ]},
        '$floor':{ args:[ 'number' ]},
        '$flowContext': {args:['string']},
        '$formatBase': {args:['number','radix']},
        '$formatInteger': {args:['number', 'picture']},
        '$formatNumber': {args:['number', 'picture', 'options']},
        '$fromMillis': {args:['number']},
        '$globalContext': {args:['string']},
        '$join':{ args:[ 'array', 'separator' ]},
        '$keys':{ args:[ 'object' ]},
        '$length':{ args:[ 'str' ]},
        '$lookup':{ args:[ 'object', 'key' ]},
        '$lowercase':{ args:[ 'str' ]},
        '$map':{ args:[ 'array', 'function' ]},
        '$match':{ args:[ 'str', 'pattern', 'limit' ]},
        '$max':{ args:[ 'array' ]},
        '$merge':{ args:[ 'array' ]},
        '$millis':{ args:[  ]},
        '$min':{ args:[ 'array' ]},
        '$moment':{ args:[ ]},
        '$not':{ args:[ 'arg' ]},
        '$now':{ args:[  ]},
        '$number':{ args:[ 'arg' ]},
        '$pad': {args:['str', 'width','char']},
        '$parseInteger': {args:['string', 'picture']},
        '$power':{ args:[ 'base', 'exponent' ]},
        '$random':{ args:[  ]},
        '$reduce':{ args:[ 'array', 'function' , 'init' ]},
        '$replace':{ args:[ 'str', 'pattern', 'replacement', 'limit' ]},
        '$reverse':{ args:[ 'array' ]},
        '$round':{ args:[ 'number', 'precision' ]},
        '$shuffle':{ args:[ 'array' ]},
        '$sift':{ args: ['object', 'function'] },
        '$single':{ args: ['array', 'function'] },
        '$sort':{ args:[ 'array', 'function' ]},
        '$split':{ args:[ 'str', 'separator', 'limit' ]},
        '$spread':{ args:[ 'object' ]},
        '$sqrt':{ args:[ 'number' ]},
        '$string':{ args:[ 'arg', 'prettify' ]},
        '$substring':{ args:[ 'str', 'start', 'length' ]},
        '$substringAfter':{ args:[ 'str', 'chars' ]},
        '$substringBefore':{ args:[ 'str', 'chars' ]},
        '$sum':{ args:[ 'array' ]},
        '$toMillis':{args:['timestamp']}, // <-------------
        '$trim':{ args:[ 'str' ]},
        '$type':{ args:['value']},
        '$uppercase':{ args:[ 'str' ]},
        '$zip':{ args:[ 'array1' ]}
    }
    jsonata.getFunctionSnippet = function(fn) {
        var snippetText = "";
        if (jsonata.functions.hasOwnProperty(fn)) {
            var def = jsonata.functions[fn];
            snippetText = "\\"+fn+"(";
            if (def.args) {
                snippetText += def.args.map(function(a,i) { return "${"+(i+1)+":"+a+"}"}).join(", ");
            }
            snippetText += ")\n"
        }
        return snippetText;
    }
})();
