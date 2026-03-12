import { IsNotEmpty, IsString } from "class-validator";

export class HobbyDTO {
    @IsString()
    @IsNotEmpty()
    username: string;



}