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



