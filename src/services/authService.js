import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export class AuthService {
  constructor({ userRepository, jwtSecret }) {
    this.userRepository = userRepository;
    this.jwtSecret = jwtSecret;
  }

  async login(username, password) {
    const normalizedUsername = username.trim().toLowerCase();
    const user = await this.userRepository.findByUsername(normalizedUsername);
    if (!user || !["gm", "player"].includes(String(user.role).toLowerCase())) {
      return null;
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return null;
    }

    const token = jwt.sign(
      { role: user.role },
      this.jwtSecret,
      { subject: user.id, expiresIn: "1h" },
    );

    return {
      token,
      user: { id: user.id, username: user.username, role: user.role },
    };
  }
}
