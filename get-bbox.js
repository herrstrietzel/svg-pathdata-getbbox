
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        // CommonJS (Node.js) environment
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        // AMD environment
        define([], factory);
    } else {
        // Browser environment
        root.pathDataBB = factory();
    }
})(this, function () {
    var pathDataBB = {};

    function getBBoxFromEl(el) {
        let geoEls = ['path', 'line', 'polyline', 'polygon', 'circle', 'ellipse', 'rect'];

        let xMin = Infinity
        let xMax = -Infinity
        let yMin = Infinity
        let yMax = -Infinity
        let geometryEls

        //single element
        if (geoEls.includes(el.nodeName)) {
            geometryEls = [el]
        } else {
            geometryEls = el.querySelectorAll(`${geoEls.join(', ')}`)
        }

        geometryEls.forEach(geoEl => {
            let pathData = getPathDataFromEl(geoEl, { toAbsolute: true, toLonghands: true })
            let { x, y, width, height } = getPathDataBBox(pathData)

            if (x < xMin) {
                xMin = x
            }
            if (y < yMin) {
                yMin = y
            }

            if (x + width > xMax) {
                xMax = x + width
            }
            if (y + height > yMax) {
                yMax = y + height
            }
        })
        let bbN = {
            x: xMin, y: yMin, width: xMax - xMin, height: yMax - yMin
        }
        return bbN

    }

    function getBBoxFromD(d) {
        // normalize to absolute coordinates and longhand commands
        let pathData = parsePathDataNormalized(d);
        let bb = getPathDataBBox(pathData);
        console.log('bbox');
        return bb;
    }

    function getPathDataBBox(pathData) {

        // save extreme values
        let xMin = Infinity;
        let xMax = -Infinity;
        let yMin = Infinity;
        let yMax = -Infinity;

        const setXYmaxMin = (pt) => {
            if (pt.x < xMin) {
                xMin = pt.x
            }
            if (pt.x > xMax) {
                xMax = pt.x
            }
            if (pt.y < yMin) {
                yMin = pt.y
            }
            if (pt.y > yMax) {
                yMax = pt.y
            }
        }

        for (let i = 0; i < pathData.length; i++) {
            let com = pathData[i]
            let { type, values } = com;
            let valuesL = values.length;
            let comPrev = pathData[i - 1] ? pathData[i - 1] : pathData[i];
            let valuesPrev = comPrev.values;
            let valuesPrevL = valuesPrev.length;

            if (valuesL) {
                let p0 = { x: valuesPrev[valuesPrevL - 2], y: valuesPrev[valuesPrevL - 1] };
                let p = { x: values[valuesL - 2], y: values[valuesL - 1] };
                // add final on path point
                setXYmaxMin(p)

                if (type === 'C' || type === 'Q') {
                    let cp1 = { x: values[0], y: values[1] };
                    let cp2 = type === 'C' ? { x: values[2], y: values[3] } : cp1;
                    let pts = type === 'C' ? [p0, cp1, cp2, p] : [p0, cp1, p];

                    let bezierExtremesT = getBezierExtremeT(pts)
                    bezierExtremesT.forEach(t => {
                        let pt = getPointAtBezierT(pts, t);
                        setXYmaxMin(pt)
                    })
                }

                else if (type === 'A') {
                    let arcExtremes = getArcExtemes(p0, values)
                    arcExtremes.forEach(pt => {
                        setXYmaxMin(pt)
                    })
                }
            }
        }

        let bbox = { x: xMin, y: yMin, width: xMax - xMin, height: yMax - yMin }
        return bbox
    }


    /**
     * based on Nikos M.'s answer
     * how-do-you-calculate-the-axis-aligned-bounding-box-of-an-ellipse
     * https://stackoverflow.com/questions/87734/#75031511
     * See also: https://github.com/foo123/Geometrize
     */
    function getArcExtemes(p0, values) {
        // compute point on ellipse from angle around ellipse (theta)
        const arc = (theta, cx, cy, rx, ry, alpha) => {
            // theta is angle in radians around arc
            // alpha is angle of rotation of ellipse in radians
            var cos = Math.cos(alpha),
                sin = Math.sin(alpha),
                x = rx * Math.cos(theta),
                y = ry * Math.sin(theta);

            return {
                x: cx + cos * x - sin * y,
                y: cy + sin * x + cos * y
            };
        }

        //parametrize arcto data
        let arcData = svgArcToCenterParam(p0.x, p0.y, values[0], values[1], values[2], values[3], values[4], values[5], values[6]);
        let { rx, ry, pt, endAngle, deltaAngle } = arcData;

        // arc rotation
        let deg = values[2];

        // final on path point
        let p = { x: values[5], y: values[6] }

        // circle/elipse center coordinates
        let [cx, cy] = [pt.x, pt.y];

        // collect extreme points – add end point
        let extremes = [p]

        // rotation to radians
        let alpha = deg * Math.PI / 180;
        let tan = Math.tan(alpha),
            p1, p2, p3, p4, theta;

        /**
        * find min/max from zeroes of directional derivative along x and y
        * along x axis
        */
        theta = Math.atan2(-ry * tan, rx);

        let angle1 = theta;
        let angle2 = theta + Math.PI;
        let angle3 = Math.atan2(ry, rx * tan);
        let angle4 = angle3 + Math.PI;


        // inner bounding box
        let xArr = [p0.x, p.x]
        let yArr = [p0.y, p.y]
        let xMin = Math.min(...xArr)
        let xMax = Math.max(...xArr)
        let yMin = Math.min(...yArr)
        let yMax = Math.max(...yArr)


        // on path point close after start
        let angleAfterStart = endAngle - deltaAngle * 0.001
        let pP2 = arc(angleAfterStart, cx, cy, rx, ry, alpha);

        // on path point close before end
        let angleBeforeEnd = endAngle - deltaAngle * 0.999
        let pP3 = arc(angleBeforeEnd, cx, cy, rx, ry, alpha);


        /**
         * expected extremes
         * if leaving inner bounding box
         * (between segment start and end point)
         * otherwise exclude elliptic extreme points
        */

        // right
        if (pP2.x > xMax || pP3.x > xMax) {
            // get point for this theta
            p1 = arc(angle1, cx, cy, rx, ry, alpha);
            extremes.push(p1)
        }

        // left
        if (pP2.x < xMin || pP3.x < xMin) {
            // get anti-symmetric point
            p2 = arc(angle2, cx, cy, rx, ry, alpha);
            extremes.push(p2)
        }

        // top
        if (pP2.y < yMin || pP3.y < yMin) {
            // get anti-symmetric point
            p4 = arc(angle4, cx, cy, rx, ry, alpha);
            extremes.push(p4)
        }

        // bottom
        if (pP2.y > yMax || pP3.y > yMax) {
            // get point for this theta
            p3 = arc(angle3, cx, cy, rx, ry, alpha);
            extremes.push(p3)
        }

        return extremes;
    }


    /**
      * based on @cuixiping;
      * https://stackoverflow.com/questions/9017100/calculate-center-of-svg-arc/12329083#12329083
      */
    function svgArcToCenterParam(x1, y1, rx, ry, degree, fA, fS, x2, y2) {
        const radian = (ux, uy, vx, vy) => {
            let dot = ux * vx + uy * vy;
            let mod = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
            let rad = Math.acos(dot / mod);
            if (ux * vy - uy * vx < 0) {
                rad = -rad;
            }
            return rad;
        };
        // degree to radian
        let phi = (degree * Math.PI) / 180;
        let cx, cy, startAngle, deltaAngle, endAngle;
        let PI = Math.PI;
        let PIx2 = PI * 2;
        if (rx < 0) {
            rx = -rx;
        }
        if (ry < 0) {
            ry = -ry;
        }
        if (rx == 0 || ry == 0) {
            // invalid arguments
            throw Error("rx and ry can not be 0");
        }
        let s_phi = Math.sin(phi);
        let c_phi = Math.cos(phi);
        let hd_x = (x1 - x2) / 2; // half diff of x
        let hd_y = (y1 - y2) / 2; // half diff of y
        let hs_x = (x1 + x2) / 2; // half sum of x
        let hs_y = (y1 + y2) / 2; // half sum of y
        // F6.5.1
        let x1_ = c_phi * hd_x + s_phi * hd_y;
        let y1_ = c_phi * hd_y - s_phi * hd_x;
        // F.6.6 Correction of out-of-range radii
        //   Step 3: Ensure radii are large enough
        let lambda = (x1_ * x1_) / (rx * rx) + (y1_ * y1_) / (ry * ry);
        if (lambda > 1) {
            rx = rx * Math.sqrt(lambda);
            ry = ry * Math.sqrt(lambda);
        }
        let rxry = rx * ry;
        let rxy1_ = rx * y1_;
        let ryx1_ = ry * x1_;
        let sum_of_sq = rxy1_ * rxy1_ + ryx1_ * ryx1_; // sum of square
        if (!sum_of_sq) {
            throw Error("start point can not be same as end point");
        }
        let coe = Math.sqrt(Math.abs((rxry * rxry - sum_of_sq) / sum_of_sq));
        if (fA == fS) {
            coe = -coe;
        }
        // F6.5.2
        let cx_ = (coe * rxy1_) / ry;
        let cy_ = (-coe * ryx1_) / rx;
        // F6.5.3
        cx = c_phi * cx_ - s_phi * cy_ + hs_x;
        cy = s_phi * cx_ + c_phi * cy_ + hs_y;
        let xcr1 = (x1_ - cx_) / rx;
        let xcr2 = (x1_ + cx_) / rx;
        let ycr1 = (y1_ - cy_) / ry;
        let ycr2 = (y1_ + cy_) / ry;
        // F6.5.5
        startAngle = radian(1, 0, xcr1, ycr1);
        // F6.5.6
        deltaAngle = radian(xcr1, ycr1, -xcr2, -ycr2);
        if (deltaAngle > PIx2) {
            deltaAngle -= PIx2;
        }
        else if (deltaAngle < 0) {
            deltaAngle += PIx2;
        }
        if (fS == false || fS == 0) {
            deltaAngle -= PIx2;
        }
        endAngle = startAngle + deltaAngle;
        if (endAngle > PIx2) {
            endAngle -= PIx2;
        }
        else if (endAngle < 0) {
            endAngle += PIx2;
        }
        let toDegFactor = 180 / PI;
        let outputObj = {
            pt: {
                x: cx,
                y: cy
            },
            rx: rx,
            ry: ry,
            startAngle_deg: startAngle * toDegFactor,
            startAngle: startAngle,
            deltaAngle_deg: deltaAngle * toDegFactor,
            deltaAngle: deltaAngle,
            endAngle_deg: endAngle * toDegFactor,
            endAngle: endAngle,
            clockwise: fS == true || fS == 1
        };
        return outputObj;
    }



    // wrapper functions for quadratic or cubic bezier point calculation
    function getPointAtBezierT(pts, t) {
        let pt = pts.length === 4 ? getPointAtCubicSegmentT(pts[0], pts[1], pts[2], pts[3], t) : getPointAtQuadraticSegmentT(pts[0], pts[1], pts[2], t)
        return pt
    }

    function getBezierExtremeT(pts) {
        let tArr = pts.length === 4 ? cubicBezierExtremeT(pts[0], pts[1], pts[2], pts[3]) : quadraticBezierExtremeT(pts[0], pts[1], pts[2]);
        return tArr;
    }


    // cubic bezier.
    function cubicBezierExtremeT(p0, cp1, cp2, p) {
        let [x0, y0, x1, y1, x2, y2, x3, y3] = [p0.x, p0.y, cp1.x, cp1.y, cp2.x, cp2.y, p.x, p.y];

        /**
         * if control points are within 
         * bounding box of start and end point 
         * we cant't have extremes
         */
        let top = Math.min(p0.y, p.y)
        let left = Math.min(p0.x, p.x)
        let right = Math.max(p0.x, p.x)
        let bottom = Math.max(p0.y, p.y)

        if (
            cp1.y >= top && cp1.y <= bottom &&
            cp2.y >= top && cp2.y <= bottom &&
            cp1.x >= left && cp1.x <= right &&
            cp2.x >= left && cp2.x <= right
        ) {
            return []
        }

        var tArr = [],
            a, b, c, t, t1, t2, b2ac, sqrt_b2ac;
        for (var i = 0; i < 2; ++i) {
            if (i == 0) {
                b = 6 * x0 - 12 * x1 + 6 * x2;
                a = -3 * x0 + 9 * x1 - 9 * x2 + 3 * x3;
                c = 3 * x1 - 3 * x0;
            } else {
                b = 6 * y0 - 12 * y1 + 6 * y2;
                a = -3 * y0 + 9 * y1 - 9 * y2 + 3 * y3;
                c = 3 * y1 - 3 * y0;
            }
            if (Math.abs(a) < 1e-12) {
                if (Math.abs(b) < 1e-12) {
                    continue;
                }
                t = -c / b;
                if (0 < t && t < 1) {
                    tArr.push(t);
                }
                continue;
            }
            b2ac = b * b - 4 * c * a;
            if (b2ac < 0) {
                if (Math.abs(b2ac) < 1e-12) {
                    t = -b / (2 * a);
                    if (0 < t && t < 1) {
                        tArr.push(t);
                    }
                }
                continue;
            }
            sqrt_b2ac = Math.sqrt(b2ac);
            t1 = (-b + sqrt_b2ac) / (2 * a);
            if (0 < t1 && t1 < 1) {
                tArr.push(t1);
            }
            t2 = (-b - sqrt_b2ac) / (2 * a);
            if (0 < t2 && t2 < 1) {
                tArr.push(t2);
            }
        }

        var j = tArr.length;
        while (j--) {
            t = tArr[j];
        }
        return tArr;

    }

    //For quadratic bezier.
    function quadraticBezierExtremeT(p0, cp1, p) {
        /**
         * if control points are within 
         * bounding box of start and end point 
         * we cant't have extremes
         */
        let top = Math.min(p0.y, p.y)
        let left = Math.min(p0.x, p.x)
        let right = Math.max(p0.x, p.x)
        let bottom = Math.max(p0.y, p.y)

        if (
            cp1.y >= top && cp1.y <= bottom &&
            cp1.x >= left && cp1.x <= right
        ) {
            return []
        }


        let [x0, y0, x1, y1, x2, y2] = [p0.x, p0.y, cp1.x, cp1.y, p.x, p.y];
        let extemeT = [];

        for (var i = 0; i < 2; ++i) {
            a = i == 0 ? x0 - 2 * x1 + x2 : y0 - 2 * y1 + y2;
            b = i == 0 ? -2 * x0 + 2 * x1 : -2 * y0 + 2 * y1;
            c = i == 0 ? x0 : y0;
            if (Math.abs(a) > 1e-12) {
                t = -b / (2 * a);
                if (t > 0 && t < 1) {
                    extemeT.push(t);
                }
            }
        }
        return extemeT
    }



    /**
     * Standalone pathData parser
     * including normalization options
     * returns a pathData array compliant
     * with the w3C SVGPathData interface draft
     * https://svgwg.org/specs/paths/#InterfaceSVGPathData
     * Usage example:
     */

    function parsePathDataNormalized(d) {
        d = d
            // remove new lines, tabs an comma with whitespace
            .replace(/[\n\r\t|,]/g, " ")
            // pre trim left and right whitespace
            .trim()
            // add space before minus sign
            .replace(/(\d)-/g, "$1 -")
            // decompose multiple adjacent decimal delimiters like 0.5.5.5 => 0.5 0.5 0.5
            .replace(/(\.)(?=(\d+\.\d+)+)(\d+)/g, "$1$3 ");

        let pathData = [];
        let cmdRegEx = /([mlcqazvhst])([^mlcqazvhst]*)/gi;
        let commands = d.match(cmdRegEx);

        // valid command value lengths
        let comLengths = { m: 2, a: 7, c: 6, h: 1, l: 2, q: 4, s: 4, t: 2, v: 1, z: 0 };

        // offsets for absolute conversion
        let offX, offY, lastX, lastY, M;

        for (let c = 0; c < commands.length; c++) {
            let com = commands[c];
            let type = com.substring(0, 1);
            let typeRel = type.toLowerCase();
            let typeAbs = type.toUpperCase();
            let isRel = type === typeRel;
            let chunkSize = comLengths[typeRel];

            // split values to array
            let values = com.substring(1, com.length).trim().split(" ").filter(Boolean);

            /**
             * A - Arc commands
             * large arc and sweep flags
             * are boolean and can be concatenated like
             * 11 or 01
             * or be concatenated with the final on path points like
             * 1110 10 => 1 1 10 10
             */
            if (typeRel === "a" && values.length != comLengths.a) {
                let n = 0,
                    arcValues = [];
                for (let i = 0; i < values.length; i++) {
                    let value = values[i];

                    // reset counter
                    if (n >= chunkSize) {
                        n = 0;
                    }
                    // if 3. or 4. parameter longer than 1
                    if ((n === 3 || n === 4) && value.length > 1) {
                        let largeArc = n === 3 ? value.substring(0, 1) : "";
                        let sweep = n === 3 ? value.substring(1, 2) : value.substring(0, 1);
                        let finalX = n === 3 ? value.substring(2) : value.substring(1);
                        let comN = [largeArc, sweep, finalX].filter(Boolean);
                        arcValues.push(comN);
                        n += comN.length;
                    } else {
                        // regular
                        arcValues.push(value);
                        n++;
                    }
                }
                values = arcValues.flat().filter(Boolean);
            }

            // string  to number
            values = values.map(Number);

            // if string contains repeated shorthand commands - split them
            let hasMultiple = values.length > chunkSize;
            let chunk = hasMultiple ? values.slice(0, chunkSize) : values;
            let comChunks = [{ type: type, values: chunk }];

            // has implicit or repeated commands – split into chunks
            if (hasMultiple) {
                let typeImplicit = typeRel === "m" ? (isRel ? "l" : "L") : type;
                for (let i = chunkSize; i < values.length; i += chunkSize) {
                    let chunk = values.slice(i, i + chunkSize);
                    comChunks.push({ type: typeImplicit, values: chunk });
                }
            }

            /**
             * convert to absolute
             * init offset from 1st M
             */
            if (c === 0) {
                offX = values[0];
                offY = values[1];
                lastX = offX;
                lastY = offY;
                M = { x: values[0], y: values[1] };
            }

            let typeFirst = comChunks[0].type;
            typeAbs = typeFirst.toUpperCase();

            // first M is always absolute
            isRel =
                typeFirst.toLowerCase() === typeFirst && pathData.length ? true : false;

            for (let i = 0; i < comChunks.length; i++) {
                let com = comChunks[i];
                let type = com.type;
                let values = com.values;
                let valuesL = values.length;
                let comPrev = comChunks[i - 1]
                    ? comChunks[i - 1]
                    : c > 0 && pathData[pathData.length - 1]
                        ? pathData[pathData.length - 1]
                        : comChunks[i];

                let valuesPrev = comPrev.values;
                let valuesPrevL = valuesPrev.length;
                isRel =
                    comChunks.length > 1
                        ? type.toLowerCase() === type && pathData.length
                        : isRel;

                if (isRel) {
                    com.type = comChunks.length > 1 ? type.toUpperCase() : typeAbs;

                    switch (typeRel) {
                        case "a":
                            com.values = [
                                values[0],
                                values[1],
                                values[2],
                                values[3],
                                values[4],
                                values[5] + offX,
                                values[6] + offY
                            ];
                            break;

                        case "h":
                        case "v":
                            com.values = type === "h" ? [values[0] + offX] : [values[0] + offY];
                            break;

                        case "m":
                        case "l":
                        case "t":
                            //update last M
                            if (type === 'm') {
                                M = { x: values[0] + offX, y: values[1] + offY };
                            }
                            com.values = [values[0] + offX, values[1] + offY];
                            break;

                        case "c":
                            com.values = [
                                values[0] + offX,
                                values[1] + offY,
                                values[2] + offX,
                                values[3] + offY,
                                values[4] + offX,
                                values[5] + offY
                            ];
                            break;

                        case "q":
                        case "s":
                            com.values = [
                                values[0] + offX,
                                values[1] + offY,
                                values[2] + offX,
                                values[3] + offY
                            ];
                            break;

                        case 'z':
                        case 'Z':
                            lastX = M.x;
                            lastY = M.y;
                            break;


                    }
                }
                // is absolute
                else {
                    offX = 0;
                    offY = 0;
                }

                /**
                 * convert shorthands
                 */
                let shorthandTypes = ["H", "V", "S", "T"];

                if (shorthandTypes.includes(typeAbs)) {
                    let cp1X, cp1Y, cpN1X, cpN1Y, cp2X, cp2Y;
                    if (com.type === "H" || com.type === "V") {
                        com.values =
                            com.type === "H" ? [com.values[0], lastY] : [lastX, com.values[0]];
                        com.type = "L";
                    } else if (com.type === "T" || com.type === "S") {
                        [cp1X, cp1Y] = [valuesPrev[0], valuesPrev[1]];
                        [cp2X, cp2Y] =
                            valuesPrevL > 2
                                ? [valuesPrev[2], valuesPrev[3]]
                                : [valuesPrev[0], valuesPrev[1]];

                        // new control point
                        cpN1X = com.type === "T" ? lastX * 2 - cp1X : lastX * 2 - cp2X;
                        cpN1Y = com.type === "T" ? lastY * 2 - cp1Y : lastY * 2 - cp2Y;

                        com.values = [cpN1X, cpN1Y, com.values].flat();
                        com.type = com.type === "T" ? "Q" : "C";
                    }
                }

                // add to pathData array
                pathData.push(com);

                // update offsets
                lastX =
                    valuesL > 1
                        ? values[valuesL - 2] + offX
                        : typeRel === "h"
                            ? values[0] + offX
                            : lastX;
                lastY =
                    valuesL > 1
                        ? values[valuesL - 1] + offY
                        : typeRel === "v"
                            ? values[0] + offY
                            : lastY;
                offX = lastX;
                offY = lastY;
            }
        }

        /**
         * first M is always absolute/uppercase -
         * unless it adds relative linetos
         * (facilitates d concatenating)
         */
        pathData[0].type = "M";

        return pathData;
    }

    // retrieve pathdata from svg geometry elements
    function getPathDataFromEl(el) {
        let pathData = [];
        let type = el.nodeName;
        let atts, attNames, d, x, y, width, height, r, rx, ry, cx, cy, x1, x2, y1, y2;

        // convert relative or absolute units 
        svgElUnitsToPixel(el)
        //console.log(el)

        const getAtts = (attNames) => {
            atts = {}
            attNames.forEach(att => {
                atts[att] = +el.getAttribute(att)
            })
            return atts
        }

        switch (type) {
            case 'path':
                d = el.getAttribute("d");
                pathData = parsePathDataNormalized(d);
                break;

            case 'rect':
                attNames = ['x', 'y', 'width', 'height', 'rx', 'ry'];
                ({ x, y, width, height, rx, ry } = getAtts(attNames));


                if (!rx && !ry) {
                    pathData = [
                        { type: "M", values: [x, y] },
                        { type: "H", values: [x + width] },
                        { type: "V", values: [y + height] },
                        { type: "H", values: [x] },
                        { type: "Z", values: [] }
                    ];
                } else {

                    if (rx > width / 2) {
                        rx = width / 2;
                    }
                    if (ry > height / 2) {
                        ry = height / 2;
                    }

                    pathData = [
                        { type: "M", values: [x + rx, y] },
                        { type: "L", values: [x + width - rx, y] },
                        { type: "A", values: [rx, ry, 0, 0, 1, x + width, y + ry] },
                        { type: "L", values: [x + width - rx, y + height - ry] },
                        { type: "A", values: [rx, ry, 0, 0, 1, x + width - rx, y + height] },
                        { type: "L", values: [x + rx, y + height] },
                        { type: "A", values: [rx, ry, 0, 0, 1, x, y + height - ry] },
                        { type: "L", values: [x, y + ry] },
                        { type: "A", values: [rx, ry, 0, 0, 1, x + rx, y] },
                        { type: "Z", values: [] }
                    ];
                }
                break;

            case 'circle':
            case 'ellipse':

                attNames = ['cx', 'cy', 'rx', 'ry', 'r'];
                ({ cx, cy, r, rx, ry } = getAtts(attNames));

                if (type === 'circle') {
                    r = r;
                    rx = r
                    ry = r
                } else {
                    rx = rx ? rx : r;
                    ry = ry ? ry : r;
                }

                pathData = [
                    { type: "M", values: [cx + rx, cy] },
                    { type: "A", values: [rx, ry, 0, 1, 1, cx - rx, cy] },
                    { type: "A", values: [rx, ry, 0, 1, 1, cx + rx, cy] },
                ];

                break;
            case 'line':
                attNames = ['x1', 'y1', 'x2', 'y2'];
                ({ x1, y1, x2, y2 } = getAtts(attNames));
                pathData = [
                    { type: "M", values: [x1, y1] },
                    { type: "L", values: [x2, y2] }
                ];
                break;
            case 'polygon':
            case 'polyline':

                let points = el.getAttribute('points').replaceAll(',', ' ').split(' ').filter(Boolean)

                for (let i = 0; i < points.length; i += 2) {
                    pathData.push({
                        type: (i === 0 ? "M" : "L"),
                        values: [+points[i], +points[i + 1]]
                    });
                }
                if (type === 'polygon') {
                    pathData.push({
                        type: "Z",
                        values: []
                    });
                }
                break;
        }

        return pathData;
    };

    /**
     * calculate single points on segments
     */
    function getPointAtCubicSegmentT(p0, cp1, cp2, p, t = 0.5) {
        let t1 = 1 - t;
        return {
            x: t1 ** 3 * p0.x +
                3 * t1 ** 2 * t * cp1.x +
                3 * t1 * t ** 2 * cp2.x +
                t ** 3 * p.x,
            y: t1 ** 3 * p0.y +
                3 * t1 ** 2 * t * cp1.y +
                3 * t1 * t ** 2 * cp2.y +
                t ** 3 * p.y
        };
    }

    function getPointAtQuadraticSegmentT(p0, cp1, p, t = 0.5) {
        let t1 = 1 - t;
        return {
            x: t1 * t1 * p0.x + 2 * t1 * t * cp1.x + t ** 2 * p.x,
            y: t1 * t1 * p0.y + 2 * t1 * t * cp1.y + t ** 2 * p.y
        };
    }

    function svgElUnitsToPixel(el, decimals = 5) {
        //console.log(this);
        const svg = el.nodeName !== "svg" ? el.closest("svg") : el;

        // convert real life units to pixels
        const translateUnitToPixel = (value) => {

            if (value === null) {
                return 0
            }
            //default dpi = 96
            let dpi = 96;
            let unit = value.match(/([a-z]+)/gi);
            unit = unit ? unit[0] : "";
            let val = parseFloat(value);
            let rat;

            // no unit - already pixes/user unit
            if (!unit) {
                return val;
            }

            switch (unit) {
                case "in":
                    rat = dpi;
                    break;
                case "pt":
                    rat = (1 / 72) * 96;
                    break;
                case "cm":
                    rat = (1 / 2.54) * 96;
                    break;
                case "mm":
                    rat = ((1 / 2.54) * 96) / 10;
                    break;
                // just a default approximation
                case "em":
                    rat = 16;
                    break;
                default:
                    rat = 1;
            }
            let valuePx = val * rat;
            return +valuePx.toFixed(decimals);
        };

        // svg width and height attributes
        let width = svg.getAttribute("width");
        width = width ? translateUnitToPixel(width) : 300;
        let height = svg.getAttribute("height");
        height = width ? translateUnitToPixel(height) : 150;

        //prefer viewBox values
        let vB = svg.getAttribute("viewBox");
        vB = vB
            ? vB
                .replace(/,/g, " ")
                .split(" ")
                .filter(Boolean)
                .map((val) => {
                    return +val;
                })
            : [];

        let w = vB.length ? vB[2] : width;
        let h = vB.length ? vB[3] : height;
        let scaleX = 0.01 * w;
        let scaleY = 0.01 * h;
        let scalRoot = Math.sqrt((Math.pow(scaleX, 2) + Math.pow(scaleY, 2)) / 2);
        let attsH = ["x", "width", "x1", "x2", "rx", "cx", "r"];
        let attsV = ["y", "height", "y1", "y2", "ry", "cy"];


        let atts = el.getAttributeNames();
        atts.forEach((att) => {
            let val = el.getAttribute(att);
            let valAbs = val;
            if (attsH.includes(att) || attsV.includes(att)) {
                let scale = attsH.includes(att) ? scaleX : scaleY;
                scale = att === "r" && w != h ? scalRoot : scale;
                let unit = val.match(/([a-z|%]+)/gi);
                unit = unit ? unit[0] : "";
                if (val.includes("%")) {
                    valAbs = parseFloat(val) * scale;
                }
                //absolute units
                else {
                    valAbs = translateUnitToPixel(val);
                }
                el.setAttribute(att, +valAbs);
            }
        });
    }


    pathDataBB.getBBoxFromEl = getBBoxFromEl;
    pathDataBB.getBBoxFromD = getBBoxFromD;
    pathDataBB.getPathDataBBox = getPathDataBBox;
    pathDataBB.getPathDataFromEl = getPathDataFromEl;
    pathDataBB.parsePathDataNormalized = parsePathDataNormalized;
    /*
    pathDataBB.getArcExtemes = getArcExtemes;
    pathDataBB.svgArcToCenterParam = svgArcToCenterParam;
    pathDataBB.getPointAtBezierT = getPointAtBezierT;
    pathDataBB.getBezierExtremeT = getBezierExtremeT;
    pathDataBB.cubicBezierExtremeT = cubicBezierExtremeT;
    pathDataBB.quadraticBezierExtremeT = quadraticBezierExtremeT;
    pathDataBB.getPointAtCubicSegmentT = getPointAtCubicSegmentT;
    pathDataBB.getPointAtQuadraticSegmentT = getPointAtQuadraticSegmentT;
    pathDataBB.svgElUnitsToPixel = svgElUnitsToPixel;
    */

    return pathDataBB;
});

if (typeof module === 'undefined') {
    var { getBBoxFromEl, getBBoxFromD, getPathDataBBox, getPathDataFromEl, parsePathDataNormalized } = pathDataBB;
}
