import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
} from 'typeorm';

@Entity('hobbies')
export class Hobbies {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    hobby: string;

    @Column()
    age: number;

    @CreateDateColumn()
    birthdate: Date;
}
