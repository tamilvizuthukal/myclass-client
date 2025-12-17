import clientPromise from '../lib/mongodb'
import bcrypt from 'bcryptjs'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { action } = req.query

  if (action !== 'login') {
    return res.status(400).json({ error: 'Invalid auth action' })
  }

  const { email, password } = req.body ?? {}

  if (!email || !password) {
    return res.status(400).json({ error: 'Missing credentials' })
  }

  try {
    const client = await clientPromise
    const db = client.db()
    const users = db.collection('users')

    const user = await users.findOne({ email })
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const match = await bcrypt.compare(password, user.password)
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    return res.status(200).json({
      ok: true,
      userId: String(user._id),
      email: user.email,
      role: user.role ?? 'user'
    })

  } catch (err) {
    console.error('AUTH ERROR:', err)
    return res.status(500).json({ error: 'Server error' })
  }
}
