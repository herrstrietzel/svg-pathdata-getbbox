var pathDataBB = require("svg-pathdata-getbbox");
var { getBBoxFromEl, getBBoxFromD, getPathDataBBox, getPathDataFromEl, parsePathDataNormalized } = pathDataBB;
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

let svgMarkup = `<svg id="svg" viewBox="0 0 100 100">
<path fill="none" stroke="black" d="M3,7 
  L13,7 
  m-20,10 
  l10,0 
  V27 
  H23 
  v10 
  h10
  C 33,43 38,47 43,47 
  c 0,5 5,10 10,10
  S 63,67 63,67       
  s -10,10 10,10
  Q 50,50 73,57
  q 20,-5 0,-10
  T 70,40
  t 0,-15
  A 5, 10 45 10 40,20  
  a5,5 20 01 -10,-10
  Z  

"/>
</svg>`;


const dom = new JSDOM(svgMarkup);
let svg = dom.window.document.querySelector('svg')

let bb = getBBoxFromEl(svg)
console.log(bb);

