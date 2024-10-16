import { v4 as uuidv4 } from 'uuid';
import sha1 from 'sha1';
import redisClient from '../utils/redis.js';
import dbClient from '../utils/db.js';

class AuthController {
  static async getConnect(req, res) {
    const authHeader = req.headers.authorization || '';
    const [type, credentials] = authHeader.split(' ');

    if (type !== 'Basic') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decodedCredentials = Buffer.from(credentials, 'base64').toString('utf-8');
    const [email, password] = decodedCredentials.split(':');
    const hashedPassword = sha1(password);

    const db = dbClient.client.db();
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ email, password: hashedPassword });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = uuidv4();
    await redisClient.set(`auth_${token}`, user._id.toString(), 86400); // 24 hours

    return res.status(200).json({ token });
  }

  static async getDisconnect(req, res) {
    const token = req.headers['x-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await redisClient.del(`auth_${token}`);
    return res.status(204).send();
  }
}

export default AuthController;
