import Vector from "../Vector";
import Matrix from "../Matrix";

// a class that describes a multivariable function R^n -> R^m and implements a bunch of operators for that function

class MFunction {
    constructor(inputDimensions, outputDimensions, vectorfn) {
        this.inputDimensions = inputDimensions >= 1 ? inputDimensions : 1;
        this.outputDimensions = outputDimensions >= 1 ? outputDimensions : 1;
        this.isParamFn = inputDimensions === 1; // parametric as in R -> R^n
        this.calc;
        this.isJacobianSet = false;
        this.getJacobianAt;
        this.getGradientAt;
        this.isHessianSet = false;
        this.getHessianAt;
        this.isScalarValued = this.outputDimensions === 1; // scalar as in R^n -> R
        this.isVectorField = this.outputDimensions === this.inputDimensions; // vector field as in R^n -> R^n
        this.setOutput(vectorfn, outputDimensions);
        this.initJacobian();
        this.initHessian();
    }

    setOutput(vectorfn) { // instead of functionarray use a function that simply takes in one vector and outputs another vector or scalar depending on the type
        this.calc = vectorfn;
    }

    partialDerivative(index) { // R^n -> R^m // returns a function that returns a vector with all the derivatives with respect to the variable at index
        if (this.isParamFn) return new Error("invalid structure for partial deriv");
        return v => { // v is a vector
            const h = 1e-10;

            let u = v.copyInstance();

            // technicality: scalar has to be used as 1x1 vector to allow for matrix operators

            if (this.isScalarValued) return new Vector([(this.calc(v.addToRow(index, h)) - this.calc(u.addToRow(index, -h))) * (0.5 / h)]);

            return this.calc(v.addToRow(index, h)).sub(this.calc(u.addToRow(index, -h))).mult(0.5 / h);
        }
    }

    secondPartialDerivative(index1, index2) {
        if (this.isParamFn) return new Error("invalid structure for scnd partial deriv");

        return v => { // v is a vector
            const h = 1e-5;

            let u = v.copyInstance();
            let w = v.copyInstance();
            let t = v.copyInstance();

            // technicality: scalar has to be used as 1x1 vector to allow for matrix operators

            const multiplier = 0.25 / (h ** 2); // uses midpoint for more accuracy // also need to add this to the other derivation algs

            const v4 = t.addToRow(index1, -h).addToRow(index2, h);
            const v3 = w.addToRow(index1, h).addToRow(index2, -h);
            const v2 = v.addToRow(index1, h).addToRow(index2, h);
            const v1 = u.addToRow(index1, -h).addToRow(index2, -h);

            if (this.isScalarValued) {
                const homoVScalar = this.calc(v1) + this.calc(v2);
                const heterVScalar = this.calc(v3) + this.calc(v4);
                return new Vector([(homoVScalar - heterVScalar) * multiplier]);
            }

            const homoVScalar = this.calc(v1).add(this.calc(v2));
            const heterVScalar = this.calc(v3).add(this.calc(v4));
            return homoVScalar.sub(heterVScalar).mult(multiplier);

        }
    }

    initJacobian() {
        if (this.isParamFn) {
            this.getJacobianAt = t => MFunction.paramDeriv(t, this.calc);
        } else {
            this.getJacobianAt = v => {
                let vectors = [];
                for (let index = 0; index < this.inputDimensions; index++) {
                    vectors.push(this.partialDerivative(index)(v));
                }
                return new Matrix(vectors);
            }
        }
        if (this.isScalarValued) this.getGradientAt = v => this.getJacobianAt(v).T().getCol(0);
        this.isJacobianSet = true;
    }

    directionalDerivative(v, x) { // x along v
        return this.getGradientAt(x).dot(v);
    }

    getCurvatureAt(t) { // R -> R
        if (!this.isParamFn) return new Error("invalid structure for curvature");

        const dS = MFunction.paramDeriv(t, this.calc); // 1st deriv

        const ddS = MFunction.secondParamDeriv(t, this.calc); // 2nd deriv

        const ddSNormSquared = ddS.getNormSquared();
        const dSNormSquared = dS.getNormSquared();
        const dSNorm = dS.getNorm();

        const dotProdSquared = ddS.dot(dS) ** 2;

        return Math.sqrt(ddSNormSquared * dSNormSquared - dotProdSquared) / (dSNorm ** 3);
    }

    getUnitTangent(t) {
        if (!this.isParamFn) return new Error("invalid structure for unit tan");

        return MFunction.paramDeriv(t, this.calc).asUnit();
    }

    getPrincipleUnitNormal(t) {
        if (!this.isParamFn) return new Error("invalid structure for unit norm");

        return MFunction.paramDeriv(t, this.getUnitTangent).asUnit();
    }

    getDivergence(v) { // R^n -> R
        if (!this.isVectorField) return new Error("invalid structure for Divergence (not a vector field)");

        return this.getJacobianAt(v).trace();
    }

    getLaplacian(v) { // R^n -> R
        if (!this.isScalarValued) return new Error("invalid structure for laplacian (not scalar valued)");

        return this.getHessianAt(v).trace();

        // why it works: laplacian f = div(grad f) = trace(J(grad f)) = trace(H(f))
    }

    initHessian() {
        if (!this.isScalarValued) return new Error("invalid structure for Hessian (not scalar valued)");

        this.getHessianAt = v => {
            let vectors = [];
            for (let col = 0; col < this.inputDimensions; col++) {
                let coords = [];

                for (let row = 0; row < this.inputDimensions; row++) {
                    coords.push(this.secondPartialDerivative(row, col)(v).get(0));
                }
                vectors.push(new Vector(coords));
            }

            return new Matrix(vectors);
        }
        this.isHessianSet = true;
    }

    secondDeriveTest() {
        // research this and make it work
    }

    getNthPartialDeriv() {
        // some day ...
    }

    getCurl(v) {
        if (!this.isVectorField) return new Error("invalid structure for Curl (not a vector field)");
        if (this.inputDimensions == 2) { // 2d case R^2 -> R (actually still R^3 to R^3 but a bit compressed)

            // WRT means with respect to, i.e. partialQ / partialX

            const qWRTx = this.partialDerivative(0)(v).get(1); // index 0 is x index 1 is Q (f(x,y) = [P(x,y), Q(x,y)]^T)
            const pWRTy = this.partialDerivative(1)(v).get(0);

            return qWRTx - pWRTy; // z coordinate of the 3d vector (in reality curl(f) = [0,0, 2d-curl(f)]^T)
        }
        if (this.inputDimensions == 3) { // 3d case R^3 -> R^3

            const jacobian = this.getJacobianAt(v);

            const rWRTy = jacobian.get(2, 1); // index 2 is (row) R index 1 is (column) Y (f(x,y,z) = [P(x,y,z), Q(x,y,z), R(x,y,z)]^T)
            const qWRTz = jacobian.get(1, 2);
            const resultX = rWRTy - qWRTz;

            const rWRTx = jacobian.get(2, 0);
            const pWRTz = jacobian.get(0, 2);
            const resultY = pWRTz - rWRTx;

            const qWRTx = jacobian.get(1, 0);
            const pWRTy = jacobian.get(0, 1);
            const resultZ = qWRTx - pWRTy;

            return new Vector([
                resultX,
                resultY,
                resultZ
            ]);
        }
        if (this.inputDimensions > 3) {
            return new Error("I don't understand the generalizations yet");
        }
    }

    static paramDeriv(t, paramFn) { // R -> R^n // dont use repeated
        // t is a scalar
        const h = 1e-10;
        const v1 = paramFn(t - h);
        const v2 = paramFn(t + h);

        v2.sub(v1).mult(0.5 / h);
        return v2;
    }

    static secondParamDeriv(t, paramFn) {
        // t is a scalar
        const h = 1e-6;
        const v1 = paramFn(t + 2 * h);
        const v2 = paramFn(t + h).mult(2);
        const v3 = paramFn(t);

        v1.sub(v2).add(v3).mult(1 / (h * h));
        return v1;
    }

    static nthParamDeriv() {
        // also some day ...
    }
}

export default MFunction;