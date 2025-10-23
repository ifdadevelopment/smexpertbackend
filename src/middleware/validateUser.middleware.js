const validateUser = (schema) => async (req, res, next) => {
    try {
        await schema.validate({
            body: req.body,
            params: req.params,
            query: req.query
        }, { abortEarly: false });

        return next();
    } catch (error) {
        console.log(error);
        res.status(400).json({
            error: 'Validation Error',
            details: error.errors || 'Some Error Occurred'
        });
    }
}

export default validateUser;
