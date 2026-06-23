// ==UserScript==
// @name         Brucespringsteen.it Smart Table (dev)
// @namespace    smarttable-lib
// @version      1.0
// @description  Renders the brucespringsteen.it record database as an interactive table.
//               Works on both the unofficial (tipe=-1) and official (tipe=-2) views.
// @author       vzell
// @match        https://www.brucespringsteen.it/DB/records.aspx*
// @require      file:///home/vzell/git/springsteen-site-parser/dist/smarttable.js
// @require      file:///home/vzell/git/springsteen-site-parser/adapters/brucespringsteen-it.js
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
