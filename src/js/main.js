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

$(function() {
    if ((window.location.hostname !== "localhost") && (window.location.hostname !== "127.0.0.1")) {
        document.title = document.title+" : "+window.location.hostname;
    }
    RED.init({
        apiRootUrl: "http://localhost:1880",
        resourcePrefix: 'public/'
    });
});
