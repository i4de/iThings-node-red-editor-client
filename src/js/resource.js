
RED.resource = {
    perfix: window['RED_RESOURCE_PERFIX'] || '',
    url: function (path) {
        return RED.resource.perfix + 'red/' + path;
    }
};
