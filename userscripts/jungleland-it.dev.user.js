// ==UserScript==
// @name         Jungleland Smart Table (dev)
// @namespace    smarttable-lib
// @version      1.0
// @match        https://www.jungleland.it/html/list.htm
// @require      file:///V:/home/vzell/git/springsteen-site-parser/dist/smarttable.js
// @require      file:///V:/home/vzell/git/springsteen-site-parser/adapters/jungleland.js
// @grant        none
// ==/UserScript==

const container = document.querySelector(JunglelandAdapter.triggerSelector);
if (container) {
    SmartTable.render({
        columns:   JunglelandAdapter.columnDefs,
        rows:      JunglelandAdapter.extract(),
        container,
    });
}
