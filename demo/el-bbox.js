var pathDataBB = require("svg-pathdata-getbbox");
var { getBBoxFromEl, getBBoxFromD, getPathDataBBox, } = pathDataBB;
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

let svgMarkup = `<svg id="svg" viewBox="0 0 100 100">
<path fill="none" stroke="black" d="M3 7 13 7m-10 10 10 0V27H23v10h10C33 43 38 47 43 47c0 5 5 10 10 10S63 67 63 67s-10 10 10 10Q50 50 73 57q20-5 0-10T70 40t0-15A5 10 45 1040 20a5 5 20 01-10-10Z"/>
</svg>`;

const dom = new JSDOM(svgMarkup);
let svg = dom.window.document.querySelector('svg')

let bb = getBBoxFromEl(svg)
console.log(bb);

