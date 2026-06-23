// ==UserScript==
// @name         Jungleland Smart Table
// @namespace    smarttable-lib
// @version      1.0
// @match        https://www.jungleland.it/html/list.htm
// @require      https://raw.githubusercontent.com/vzell/smarttable-lib/main/dist/smarttable.min.js
// @require      https://raw.githubusercontent.com/vzell/smarttable-lib/main/adapters/jungleland.js
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
