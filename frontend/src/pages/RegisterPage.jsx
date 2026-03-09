import React from 'react';
import { AuthLayout, RegisterForm } from '../components/auth/AuthForm';

export default function RegisterPage() {
  return (
    <AuthLayout title="Create your account" subtitle="Start turning Excel files into dashboards">
      <RegisterForm />
    </AuthLayout>
  );
}
