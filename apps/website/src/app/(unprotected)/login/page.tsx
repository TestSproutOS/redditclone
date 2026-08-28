import type { Metadata } from "next"

import { Suspense } from "react"
import { SignInForm } from "./sign-in-form"

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your account",
}

type SignInPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { error, next } = await searchParams
  return (
    <div className="py-36 flex flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center flex flex-col gap-y-6 sm:w-[350px]">
        <div className="flex flex-col gap-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Create an account with a username</p>
        </div>
        <Suspense>
          <SignInForm error={error} next={next} />
        </Suspense>
      </div>
    </div>
  )
}
