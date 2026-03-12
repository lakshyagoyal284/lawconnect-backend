import pool from '../config/db.js';
import bcrypt from 'bcryptjs';

class User {
  // Create new user
  static async create(userData) {
    const { name, email, password, role = 'client' } = userData;
    
    console.log('Creating user with data:', { name, email, role });
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const query = `
      INSERT INTO users (name, email, password, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, NOW(), NOW())
    `;
    
    try {
      console.log('Executing query:', query);
      console.log('With params:', [name, email, '***', role]);
      
      const [result] = await pool.execute(query, [name, email, hashedPassword, role]);
      console.log('User inserted successfully, ID:', result.insertId);
      
      return { id: result.insertId, name, email, role };
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }
  
  // Find user by email
  static async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = ?';
    
    try {
      const [rows] = await pool.execute(query, [email]);
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  }
  
  // Find user by ID
  static async findById(id) {
    const query = 'SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = ?';
    
    try {
      const [rows] = await pool.execute(query, [id]);
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  }
  
  // Compare password
  static async comparePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }
}

export default User;
