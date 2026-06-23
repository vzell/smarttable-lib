// ==UserScript==
// @name         Brucespringsteen.it Smart Table
// @namespace    smarttable-lib
// @version      1.0
// @description  Renders the brucespringsteen.it record database as an interactive table.
//               Works on both the unofficial (tipe=-1) and official (tipe=-2) views.
// @author       vzell
// @match        https://www.brucespringsteen.it/DB/records.aspx*
// @require      https://raw.githubusercontent.com/vzell/smarttable-lib/main/dist/smarttable.min.js
// @require      https://raw.githubusercontent.com/vzell/smarttable-lib/main/adapters/brucespringsteen-it.js
// @grant        none
// ==/UserScript==

// The page is an ASP.NET form — type="button" on our buttons (already set in
// the renderer) prevents them from submitting the form.
const container = document.querySelector(BrucespringsteenitAdapter.triggerSelector);
if (container) {
    SmartTable.render({
        columns:   BrucespringsteenitAdapter.columnDefs,
        rows:      BrucespringsteenitAdapter.extract(),
        container,
    });
}
