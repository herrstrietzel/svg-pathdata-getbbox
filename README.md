# svg-pathdata-getbbox
Calculates a path bounding box based on its raw pathdata.  

Some libraries fail at parsing all possible shorthand notations – most notably the (quite questionable) ability to concanenate `A` arcto `largeArc`, `sweep` and final point:  

```
A 5 10 45 1 0 40 20
```

can also be expressed like so

```
A 5 10 45 1040 20
```

... pretty hard to unravel – I don't blame anyone.   

This script combines multiple non-iterative approaches to find extreme points for:  
* `Q` quadratic béziers 
* `C` cubic béziers
* `A` arc commands

Normalization doesn't convert quadratics or arcs to cubics.  
All in all, this method should be quite fast and accurate.


## Usage - node.js

```
npm install svg-pathdata-getbbox
```

```
var pathDataBB = require("svg-pathdata-getbbox");

var d = `
M3,7 
L13,7 
m-10,10 
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
A 5, 10 45 1040,20  
a5,5 20 01 -10,-10
Z 
`;

var bb = pathDataBB.getBBoxFromD(d);
console.log(bb)
```

## Usage - browser

Load script e.g via cdn

```
<script src="https://cdn.jsdelivr.net/gh/herrstrietzel/svg-pathdata-getbbox@main/index.js"></script>
```

```
let d = `
M3,7 
L13,7 
m-10,10 
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
A 5, 10 45 1040,20  
a5,5 20 01 -10,-10
Z 
`;

let bb = pathDataBB.getBBoxFromD(d);
console.log(bb);

```

See [codepen example](https://codepen.io/herrstrietzel/pen/QWoyYjY?editors=1010) 

### Credits
* Nikos M./foo123 for the algorhythm finding extermes on ellipses.   
Check also this author's library ["Geometrize"](https://github.com/foo123/Geometrize)  
*  StackOverflow user @cuixiping for compiling and explaining the [calculations for quadratic and cubic béziers](https://stackoverflow.com/questions/9017100/calculate-center-of-svg-arc/12329083#12329083) and also the [arc parametrisation](https://stackoverflow.com/questions/9017100/calculate-center-of-svg-arc/12329083#12329083)
* obviously, Dmitry Baranovskiy – a lot of these helper functions originate either from Raphaël or snap.svg
* Jarek Foksa for developping the great [getPathData() polyfill](https://github.com/jarek-foksa/path-data-polyfill) – probably the most productive contributor to the ["new" W3C SVGPathData interface draft](https://svgwg.org/specs/paths/#InterfaceSVGPathData).

