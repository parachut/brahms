import Analytics from 'analytics-node'
import { ApolloServer } from 'apollo-server-express'
import cors from 'cors'
import crypto from 'crypto'
import { createContext } from 'dataloader-sequelize'
import express from 'express'
import expressJwt from 'express-jwt'
import fs from 'fs'
import jwt from 'jsonwebtoken'
import requestIp from 'request-ip'
import { buildSchema } from 'type-graphql'
// import jsonwebtoken from 'jsonwebtoken';

require('dotenv').config()

import { signOptions } from '../certs'
import { sequelize } from './db'
import hooks from './hooks'
import { redis } from './redis'
import { customAuthChecker } from './utils/customAuthChecker'

// import { migrator } from './migrator'
const PORT = process.env.PORT || 4000
const GQLPATH = '/graphql'

const analytics = new Analytics(process.env.SEGMENT)
const jwtSecret = fs.readFileSync('./certs/private.key', 'utf8')

const main = async () => {
  /**
  const token = jsonwebtoken.sign(
    {
      id: '760e585b-ae7f-4146-81aa-e783d0b9a218',
      roles: ['MEMBER'],
    },
    fs.readFileSync('./certs/private.key', 'utf8'),
    signOptions,
  );

    console.log(token);


   */

  const dataloaderContext = createContext(sequelize)

  const schema = await buildSchema({
    authChecker: customAuthChecker,
    resolvers: [
      __dirname + '/resolvers/*.resolver.ts',
      __dirname + '/resolvers/*.resolver.js',
    ],
  })

  const app = express()
  // app.use('/migrator', migrator)

  app.use(GQLPATH, cors())

  const server = new ApolloServer({
    introspection: true,
    playground: true,
    schema,
    context: ({ req, connection }: any) => {
      if (!req || !req.headers) {
        return connection.context
      }

      const context = {
        analytics,
        clientIp: requestIp.getClientIp(req),
        dataloaderContext,
        redis,
        req,
        sequelize,
        user: req.user,
      }
      return context
    },
  })

  app.use(
    GQLPATH,
    expressJwt({
      algorithms: ['RS256'],
      credentialsRequired: false,
      secret: fs.readFileSync('./certs/public.key', 'utf8'),
    }),
  )

  server.applyMiddleware({ app, path: GQLPATH })

  app.use('/hooks', hooks)
  // app.use('/cron', cron);

  app.use(
    require('forest-express-sequelize').init({
      authSecret: process.env.FOREST_AUTH_SECRET,
      configDir: __dirname + '/forest',
      envSecret: process.env.FOREST_ENV_SECRET,
      modelsDir: __dirname + '/models',
      sequelize,
    }),
  )

  fs.readdirSync(__dirname + '/routes').forEach((file) => {
    if (file[0] !== '.') {
      app.use('/forest', require('./routes/' + file))
    }
  })

  app.listen(PORT, () => {
    // Instantiates a client.
    console.log(`Listening on ${PORT}`)
  })
}

main()
