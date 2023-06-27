/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import logoImage from "../../../public/robotbook2.png";
import Image from "next/image";
import { Fragment } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Tooltip from "@radix-ui/react-tooltip";
// import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { signIn, signOut, useSession } from "next-auth/react";
import axios, {
  type AxiosError,
  isAxiosError,
  type AxiosResponse,
} from "axios";
import { useQuery } from "@tanstack/react-query";
// import { type ProfileType } from "~/types/types";
import Link from "next/link";
import { api } from "~/utils/api";
import { RiCoinsLine } from "react-icons/ri";

import { useRouter } from "next/router";
import { MdClose, MdMenu, MdOutlineFeedback } from "react-icons/md";
import { ModeToggle } from "~/components/DarkModeToggle/DarkModeToggle";
// import FeedbackModal from "../FeedbackModal/FeedbackModal";
// import IssueOccurredModal from "../IssueOccurredModal/IssueOccurredModal";
// import NoMembersProfileModal from "../NoMembersProfileModal/NoMembersProfileModal";

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

export default function Navbar() {
  const router = useRouter();

  const [noMembershipModalIsOpen, setNoMembershipModalIsOpen] = useState(false);
  const [feedbackModalIsOpen, setFeedbackModalIsOpen] = useState(false);

  // to deal with veym profile issues
  const [reloadModalIsOpen, setReloadModalIsOpen] = useState(false);

  const [open, setOpen] = useState(false);

  const navigation: { name: string; href: string; current: boolean }[] = [
    // ...(isLoggedIn
    //   ? [
    //       {
    //         name: "History",
    //         href: "/history",
    //         current: router.asPath === "/history",
    //       },
    //     ]
    //   : []),
    {
      name: "Buy Credits",
      href: "/credits",
      current: router.asPath === "/credits",
    },
  ];

  return (
    <>
      <nav className="fixed z-50 w-full border-b border-b-gray-800 bg-[#0f152d]">
        <div className="mx-auto w-full px-2 sm:px-6 lg:px-8">
          <div className="relative flex h-16 items-center justify-between">
            <div className="inset-y-0 left-0 flex items-center md:hidden">
              {/* Mobile menu button*/}
              <button
                className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setOpen(!open)}
              >
                <span className="sr-only">Open main menu</span>
                {open ? (
                  // <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                  <MdClose className="block h-6 w-6" aria-hidden="true" />
                ) : (
                  // <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                  <MdMenu className="block h-6 w-6" aria-hidden="true" />
                )}
              </button>
            </div>
            <div className="flex flex-1 items-center sm:items-center sm:justify-start">
              <Link href="/">
                <div className="flex flex-shrink-0 items-center">
                  <Image
                    className="mr-3 h-12 w-auto"
                    src={logoImage}
                    alt="TNTT Helper Logo"
                    width={128}
                    height={128}
                    priority
                  />
                  <div className=" flex items-center gap-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                    <span>
                      Quiz <span className="text-cyan-400">Ai</span>de
                    </span>
                    <span className="rounded-sm bg-purple-600 px-1.5 py-0.5 text-xs font-medium sm:ml-1 sm:text-sm">
                      BETA
                    </span>
                  </div>
                </div>
              </Link>
              <div className="hidden sm:ml-6 md:flex">
                <div className="flex items-center space-x-1">
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={classNames(
                        item.current
                          ? "bg-gray-900 text-white"
                          : "text-gray-300 hover:bg-gray-700 hover:text-white",
                        "rounded-md px-2 py-2 text-sm font-medium"
                      )}
                      aria-current={item.current ? "page" : undefined}
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">
              {/* <Tooltip content="Submit Feedback">   */}
              <button
                type="button"
                className=" mr-2 hidden rounded-md border border-slate-600 bg-gray-800 p-1 text-gray-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800 sm:block"
                onClick={() => {
                  setFeedbackModalIsOpen(true);
                }}
              >
                <span className="sr-only">View notifications</span>
                <MdOutlineFeedback className="h-6 w-6" aria-hidden="true" />
              </button>
              <ModeToggle />
              {/* </Tooltip>   */}

              {/* Profile dropdown */}
              {/* {profileData && userData ? (  
                <div className="flex items-center gap-1 sm:gap-2">  
                  <Link href="/credits">  
                    <span className="inline-flex items-center rounded border border-slate-500 bg-slate-700 px-2.5 py-1.5 text-sm font-normal text-gray-100 transition duration-150 hover:opacity-90">  
                      <RiCoinsLine className="mr-2" />  
                      {userData?.credits}  
                      <span className="ml-1 hidden sm:inline-block">  
                        credits  
                      </span>  
                    </span>  
                  </Link>  
  
                  <DropdownMenu className="relative ml-3">  
                    <DropdownMenu.Trigger className="flex rounded-full bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800">  
                      <span className="sr-only">Open user menu</span>  
                      {profileData?.photo ? (  
                        <img  
                          className="h-8 w-8 rounded-full object-cover"  
                          src={profileData?.photo || ""}  
                          alt={`${profileData?.firstName || ""} ${  
                            profileData?.lastName || ""  
                          }}`}  
                        />  
                      ) : (  
                        <div className="relative inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gray-600 ">  
                          <span className="font-medium tracking-wider text-gray-300">  
                            {`${profileData?.firstName?.charAt(0) || ""}${  
                              profileData?.lastName?.charAt(0) || ""  
                            }`}  
                          </span>  
                        </div>  
                      )}  
                    </DropdownMenu.Trigger>  
                    <DropdownMenu.Content className="z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">  
                      <DropdownMenu.Item as="a" href="/profile">  
                        Profile  
                      </DropdownMenu.Item>  
                      {userData.isAdmin ? (  
                        <DropdownMenu.Item as="a" href="/admin">  
                          Admin Console  
                        </DropdownMenu.Item>  
                      ) : null}  
                      <DropdownMenu.Item onSelect={() => {  
                        setFeedbackModalIsOpen(true);  
                      }}>  
                        Submit Feedback  
                      </DropdownMenu.Item>  
                      <DropdownMenu.Item onSelect={() =>  
                        void signOut({ callbackUrl: "/" })  
                      }>  
                        Sign out  
                      </DropdownMenu.Item>  
                    </DropdownMenu.Content>  
                  </DropdownMenu>  
                </div>  
              ) : (  
                <div className="flex items-center gap-2">  
                  <button  
                    type="button"  
                    className="inline-flex min-w-[80px] justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 px-3 py-2 text-center text-sm font-medium text-white transition duration-150 hover:bg-gradient-to-bl focus:outline-none focus:ring-4 focus:ring-blue-800  sm:px-5"  
                    onClick={() => {  
                      if (  
                        !(profileIsLoading || sessionStatus === "loading")  
                      ) {  
                        void signIn("azure-ad-b2c", { callbackUrl: "/" });  
                      }  
                    }}  
                  >  
                    {profileIsLoading || sessionStatus === "loading" ? (  
                     <span className="flex items-center justify-center">  
                      Loading  
                      </span>  
                    ) : (  
                      <span>Sign in</span>  
                    )}  
                  </button>  
                </div>  
              )}   */}
            </div>
          </div>
        </div>

        {open && (
          <div className="md:hidden">
            <div className="space-y-1 px-2 pb-3 pt-2">
              {navigation.map((item) => (
                <Link href={item.href} key={item.name}>
                  <button
                    className={classNames(
                      item.current
                        ? "bg-gray-900 text-white"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white",
                      "block rounded-md px-3 py-2 text-base font-medium"
                    )}
                    aria-current={item.current ? "page" : undefined}
                  >
                    {item.name}
                  </button>
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* <NoMembersProfileModal isOpen={noMembershipModalIsOpen} />  
      <IssueOccurredModal isOpen={reloadModalIsOpen} />  
      <FeedbackModal  
        isOpen={feedbackModalIsOpen}  
        setIsOpen={setFeedbackModalIsOpen}  
      />   */}
    </>
  );
}
