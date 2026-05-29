import type { CollectionConfig } from 'payload'

import {
  ADMIN_ROLE,
  adminsOnly,
  isSuperAdmin,
  SUPER_ADMIN_ROLE,
  superAdminsOnly,
  superAdminsOrSelf,
} from '../access'
import {
  SUPER_ADMIN_ANIMAL_QUESTION,
  SUPER_ADMIN_FOOD_QUESTION,
  hashSecurityAnswer,
  isNonEmptyString,
} from '../adminRecovery'
import {
  ADMIN_ROLE_OPTIONS,
  assertCanChangeAdminRole,
  assertCanDeleteAdmin,
  countAdmins,
  countSuperAdmins,
  resolveAdminRole,
} from '../adminSecurity'

export const Admins: CollectionConfig = {
  slug: 'admins',
  auth: true,
  admin: {
    useAsTitle: 'email',
  },
  access: {
    create: superAdminsOnly,
    delete: superAdminsOnly,
    read: adminsOnly,
    update: superAdminsOrSelf,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        if (!data) return data
        if (req.context.skipAdminRoleGuards) {
          return data
        }

        const existingAdminCount =
          operation === 'create' ? await countAdmins(req.payload) : 0
        const forcePublicAdminRole = req.context.forcePublicAdminRole === true
        const nextRole =
          forcePublicAdminRole
            ? ADMIN_ROLE
            : existingAdminCount === 0
              ? SUPER_ADMIN_ROLE
              : resolveAdminRole({
                existingAdminCount,
                incomingRole: data.role,
                originalRole: originalDoc?.role,
              })

        if (operation === 'update') {
          const superAdminCount = await countSuperAdmins(req.payload)

          assertCanChangeAdminRole({
            actingUser: req.user,
            nextRole,
            originalRole: originalDoc?.role,
            superAdminCount,
            targetAdminId: originalDoc?.id,
          })
        }

        data.role = nextRole
        const animalAnswer = data.securityQuestionAnimalAnswer
        const foodAnswer = data.securityQuestionFoodAnswer
        const shouldRotateSecurityAnswers =
          isNonEmptyString(animalAnswer) || isNonEmptyString(foodAnswer)
        const existingAnimalHash =
          typeof data.securityQuestionAnimalHash === 'string'
            ? data.securityQuestionAnimalHash
            : originalDoc?.securityQuestionAnimalHash
        const existingFoodHash =
          typeof data.securityQuestionFoodHash === 'string'
            ? data.securityQuestionFoodHash
            : originalDoc?.securityQuestionFoodHash

        if (nextRole === SUPER_ADMIN_ROLE) {
          const requiresSecurityAnswers =
            operation === 'create' ||
            !existingAnimalHash ||
            !existingFoodHash ||
            shouldRotateSecurityAnswers

          if (requiresSecurityAnswers) {
            if (!isNonEmptyString(animalAnswer) || !isNonEmptyString(foodAnswer)) {
              throw new Error('Super admins must provide answers for both security questions.')
            }

            data.securityQuestionAnimalHash = hashSecurityAnswer(animalAnswer)
            data.securityQuestionFoodHash = hashSecurityAnswer(foodAnswer)
          }
        } else {
          data.securityQuestionAnimalHash = null
          data.securityQuestionFoodHash = null
        }

        delete data.securityQuestionAnimalAnswer
        delete data.securityQuestionFoodAnswer

        return data
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        if (req.context.skipAdminRoleGuards) {
          return
        }

        const targetAdmin = await req.payload.findByID({
          collection: 'admins',
          id,
          depth: 0,
          overrideAccess: true,
        })
        const superAdminCount = await countSuperAdmins(req.payload)

        assertCanDeleteAdmin({
          actingUser: req.user,
          superAdminCount,
          targetAdmin,
        })
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'role',
      type: 'select',
      defaultValue: 'admin',
      options: [...ADMIN_ROLE_OPTIONS],
      required: true,
      access: {
        create: ({ req }) => !req.user || superAdminsOnly({ req }),
        read: adminsOnly,
        update: superAdminsOnly,
      },
      admin: {
        condition: (_, __, { user }) => isSuperAdmin(user),
        description:
          'Super admins can manage other admin accounts. Regular admins can manage content but cannot manage admin roles.',
        position: 'sidebar',
      },
    },
    {
      name: 'securityQuestionAnimalAnswer',
      type: 'text',
      virtual: true,
      label: 'Security Question 1 Answer',
      admin: {
        condition: (_, siblingData) => siblingData.role === SUPER_ADMIN_ROLE,
        description: SUPER_ADMIN_ANIMAL_QUESTION,
        position: 'sidebar',
      },
    },
    {
      name: 'securityQuestionFoodAnswer',
      type: 'text',
      virtual: true,
      label: 'Security Question 2 Answer',
      admin: {
        condition: (_, siblingData) => siblingData.role === SUPER_ADMIN_ROLE,
        description: SUPER_ADMIN_FOOD_QUESTION,
        position: 'sidebar',
      },
    },
    {
      name: 'securityQuestionAnimalHash',
      type: 'text',
      access: {
        create: () => false,
        read: () => false,
        update: () => false,
      },
      admin: {
        hidden: true,
      },
    },
    {
      name: 'securityQuestionFoodHash',
      type: 'text',
      access: {
        create: () => false,
        read: () => false,
        update: () => false,
      },
      admin: {
        hidden: true,
      },
    },
  ],
}
