import jwt from "jsonwebtoken"

const genToken = async (userId) =>{
    try{
        const token = await jwt.sign({userId},process.env.JWT_SECRET,{expiresIn:"10y"})
        return token 
    }catch(crror){
        return res.status(500).json(`Token generation error !${error}`)
    }
}

export default genToken