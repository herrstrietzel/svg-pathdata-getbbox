/**
* self contained alternative to
* calculate bounding box from pathdata string
*/

function getBBoxFromD(d) {
    let pathData = parseDtoPathData(d);

    // normalize to absolute coordinates and longhand commands
    pathData = pathDataToLonghands(pathData);
    let bb = getPathDataBBox(pathData);
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
    startAngle = radian(1.0, 0, xcr1, ycr1);
    // F6.5.6
    deltaAngle = radian(xcr1, ycr1, -xcr2, -ycr2);
    while (deltaAngle > PIx2) {
        deltaAngle -= PIx2;
    }
    while (deltaAngle < 0) {
        deltaAngle += PIx2;
    }
    if (fS == false || fS == 0) {
        deltaAngle -= PIx2;
    }
    endAngle = startAngle + deltaAngle;
    while (endAngle > PIx2) {
        endAngle -= PIx2;
    }
    while (endAngle < 0) {
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
        //console.log('no extreme cubic');
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
        //console.log('no extreme quadratic');
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
