import type { Access } from 'payload'

export const anyone: Access = () => true

export const adminsOnly: Access = ({ req: { user } }) => Boolean(user)
